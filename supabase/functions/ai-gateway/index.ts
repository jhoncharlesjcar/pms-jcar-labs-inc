import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { AIGatewayRequest } from "./types.ts";
import { buildSystemPrompt } from "./prompts.ts";
import { geminiToolsDefinition, ToolExecutor } from "./tools.ts";
import { callGemini, submitToolResponseToGemini } from "./gemini.ts";

declare const Deno: any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

async function createSessionToken(hotelId: string, sessionId: string, secret: string): Promise<string> {
  return hmac(`${hotelId}:${sessionId}`, secret);
}

async function validateSessionToken(
  hotelId: string, sessionId: string, token: string, secret: string
): Promise<boolean> {
  const expected = await createSessionToken(hotelId, sessionId, secret);
  return constantTimeEqual(expected, token);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  try {
    const body: AIGatewayRequest = await req.json();
    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const sessionSecret = Deno.env.get('AI_SESSION_SECRET');
    if (!sessionSecret || sessionSecret.length < 32) {
      console.error('[AI Gateway] AI_SESSION_SECRET is missing or too short');
      return errorResponse('Agent session service is not configured', 503);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: config, error: configError } = await supabase
      .from('ai_hotel_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .single();
    if (configError || !config) return errorResponse('Hotel configuration not found', 404);
    if (!config.agent_enabled) return errorResponse('Agent is currently disabled', 403);

    if (body.action === 'bootstrap') {
      const requestedSession = String(body.session_id || '');
      const requestedToken = String(body.session_token || '');
      const canReuse = uuidPattern.test(requestedSession) && requestedToken &&
        await validateSessionToken(hotelId, requestedSession, requestedToken, sessionSecret);
      const sessionId = canReuse ? requestedSession : crypto.randomUUID();
      const sessionToken = await createSessionToken(hotelId, sessionId, sessionSecret);
      return jsonResponse({
        session_id: sessionId,
        session_token: sessionToken,
        config: {
          agent_enabled: config.agent_enabled,
          agent_name: config.agent_name,
          welcome_message: config.welcome_message,
          languages: config.languages,
          operating_hours: config.operating_hours
        }
      });
    }

    const channel = body.channel || 'web';
    const isExternalChannel = ['whatsapp', 'instagram', 'facebook', 'guest_portal'].includes(channel);
    const configuredChannelSecret = Deno.env.get('CHANNEL_GATEWAY_SECRET') || '';
    const providedChannelSecret = req.headers.get('x-jcar-channel-secret') || '';
    const isTrustedChannelRequest = isExternalChannel && configuredChannelSecret.length >= 32
      && constantTimeEqual(configuredChannelSecret, providedChannelSecret);
    if (isExternalChannel && !isTrustedChannelRequest) return errorResponse('Invalid channel credentials', 401);

    const externalAccountId = String(body.external_account_id || '').trim();
    const externalContactId = String(body.external_contact_id || '').trim();
    const externalMessageId = String(body.external_message_id || '').trim();
    let channelDelaySeconds = Number(config.response_delay_seconds || 0);
    let sessionId = String(body.session_id || '');
    const sessionToken = String(body.session_token || '');
    const message = String(body.message || '').trim();
    if (isTrustedChannelRequest) {
      if (!externalAccountId) return errorResponse('Missing external account identifier', 400);
      if (!['delivery_status', 'pull_outbound'].includes(body.action || 'message')
        && (!externalContactId || !externalMessageId || !message)) {
        return errorResponse('Missing normalized channel fields', 400);
      }
      if (externalAccountId.length > 200 || externalContactId.length > 200 || externalMessageId.length > 300) {
        return errorResponse('Channel identifier is too long', 400);
      }
      const { data: channelConnection, error: channelConnectionError } = await supabase
        .from('ai_channel_connections')
        .select('id,response_delay_seconds,enabled')
        .eq('hotel_id', hotelId)
        .eq('channel', channel)
        .eq('external_account_id', externalAccountId)
        .eq('enabled', true)
        .maybeSingle();
      if (channelConnectionError || !channelConnection) return errorResponse('Channel is not enabled for this hotel', 403);
      channelDelaySeconds = Number(channelConnection.response_delay_seconds || channelDelaySeconds);
      if (body.action === 'delivery_status') {
        const deliveryMessageId = String(body.delivery_message_id || '');
        const deliveryStatus = String(body.delivery_status || '');
        if (!uuidPattern.test(deliveryMessageId) || !['sent', 'delivered', 'read', 'failed'].includes(deliveryStatus)) {
          return errorResponse('Invalid delivery status event', 400);
        }
        const { data: outboundMessage } = await supabase.from('ai_messages')
          .select('conversation_id').eq('id', deliveryMessageId).eq('hotel_id', hotelId)
          .eq('direction', 'outbound').maybeSingle();
        if (!outboundMessage) return errorResponse('Outbound message not found', 404);
        const { data: outboundConversation } = await supabase.from('ai_conversations')
          .select('id').eq('id', outboundMessage.conversation_id).eq('channel', channel)
          .eq('external_account_id', externalAccountId).maybeSingle();
        if (!outboundConversation) return errorResponse('Outbound message does not belong to this channel connection', 403);
        const { data: updated, error: deliveryError } = await supabase.from('ai_messages').update({
          delivery_status: deliveryStatus,
          error_code: deliveryStatus === 'failed' ? String(body.error_code || 'channel_delivery_failed').slice(0, 200) : null
        }).eq('id', deliveryMessageId).eq('hotel_id', hotelId).eq('direction', 'outbound').select('id').maybeSingle();
        if (deliveryError) throw deliveryError;
        if (!updated) return errorResponse('Outbound message not found', 404);
        return jsonResponse({ success: true, message_id: updated.id, delivery_status: deliveryStatus });
      }
      if (body.action === 'pull_outbound') {
        const requestedLimit = Number(body.limit || 10);
        const { data: outboundMessages, error: outboundError } = await supabase.rpc('ai_claim_channel_messages', {
          p_hotel_id: hotelId,
          p_channel: channel,
          p_external_account_id: externalAccountId,
          p_limit: Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 10
        });
        if (outboundError) throw outboundError;
        return jsonResponse({ success: true, messages: outboundMessages || [] });
      }
      if (!uuidPattern.test(sessionId)) sessionId = crypto.randomUUID();
    } else {
      if (!uuidPattern.test(sessionId) || !sessionToken || !message) return errorResponse('Missing required fields', 400);
      if (!await validateSessionToken(hotelId, sessionId, sessionToken, sessionSecret)) {
        return errorResponse('Invalid conversation session', 401);
      }
    }
    if (message.length > 2000) return errorResponse('Message is too long', 413);

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
    const rateIdentity = isTrustedChannelRequest ? `${channel}:${externalContactId}` : clientIp;
    const ipHash = await sha256(`ai:${rateIdentity}:${hotelId}`);
    const { data: allowed, error: rateError } = await supabase.rpc('check_booking_rate_limit', {
      p_ip_hash: ipHash,
      p_max_attempts: 30,
      p_window_seconds: 300
    });
    if (rateError || allowed === false) return errorResponse('Too many messages. Try again shortly.', 429);

    if (isTrustedChannelRequest) {
      const { data: duplicate } = await supabase.from('ai_messages')
        .select('conversation_id').eq('hotel_id', hotelId).eq('external_message_id', externalMessageId).maybeSingle();
      if (duplicate) {
        const { data: previousResponse } = await supabase.from('ai_messages').select('content')
          .eq('conversation_id', duplicate.conversation_id).eq('role', 'assistant')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        return jsonResponse({ duplicate: true, conversation_id: duplicate.conversation_id, response: previousResponse?.content || null });
      }
    }

    let conversationQuery = supabase
      .from('ai_conversations')
      .select('*')
      .eq('hotel_id', hotelId);
    conversationQuery = isTrustedChannelRequest
      ? conversationQuery.eq('channel', channel).eq('external_account_id', externalAccountId)
        .eq('external_contact_id', externalContactId).not('status', 'in', '(closed,abandoned)')
      : conversationQuery.eq('session_id', sessionId);
    const { data: existingConversation, error: conversationError } = await conversationQuery.maybeSingle();
    if (conversationError) throw conversationError;
    let conversation = existingConversation;

    if (!conversation) {
      const { data: created, error: createError } = await supabase.from('ai_conversations').insert({
        hotel_id: hotelId,
        session_id: sessionId,
        channel,
        external_account_id: isTrustedChannelRequest ? externalAccountId : null,
        external_contact_id: isTrustedChannelRequest ? externalContactId : null,
        status: 'active',
        journey_stage: 'lead',
        last_inbound_at: new Date().toISOString()
      }).select().single();
      if (createError) throw createError;
      conversation = created;
      await supabase.from('ai_messages').insert({
        conversation_id: conversation.id,
        hotel_id: hotelId,
        role: 'assistant',
        content: config.welcome_message,
        direction: 'outbound',
        delivery_status: 'sent'
      });
    }

    if (conversation.human_controlled || conversation.status === 'handed_off' || conversation.status === 'closed') {
      return jsonResponse({
        conversation_id: conversation.id,
        response: config.handoff_message,
        status: conversation.status,
        journey_stage: conversation.journey_stage
      });
    }

    const { error: userMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id: hotelId,
      role: 'user',
      content: message,
      direction: 'inbound',
      delivery_status: 'received',
      external_message_id: isTrustedChannelRequest ? externalMessageId : null
    });
    if (userMessageError) throw userMessageError;
    await supabase.from('ai_conversations').update({
      last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id);

    const { data: historyData, error: historyError } = await supabase
      .from('ai_messages')
      .select('role,content')
      .eq('conversation_id', conversation.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (historyError) throw historyError;
    const history: any[] = (historyData || []).reverse();

    const { data: knowledge, error: knowledgeError } = await supabase
      .from('ai_hotel_knowledge')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('activo', true)
      .order('priority', { ascending: false })
      .limit(100);
    if (knowledgeError) throw knowledgeError;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return errorResponse('AI model is not configured', 503);
    const systemPrompt = buildSystemPrompt(config, knowledge || []);
    let aiResponse = await callGemini(systemPrompt, history.slice(0, -1), message, geminiToolsDefinition, apiKey);
    let finalResponseText = '';
    const executor = new ToolExecutor(supabase, hotelId, conversation.id);

    for (let iteration = 0; iteration < 5; iteration++) {
      const candidate = aiResponse.candidates?.[0];
      if (!candidate?.content?.parts) break;
      const parts = candidate.content.parts;
      const textParts = parts.filter((part: any) => typeof part.text === 'string');
      if (textParts.length) finalResponseText += textParts.map((part: any) => part.text).join('');
      const calls = parts.filter((part: any) => part.functionCall).map((part: any) => part.functionCall);
      if (!calls.length) break;

      const toolResults = [];
      for (const call of calls) {
        const result = await executor.executeTool(call.name, call.args || {});
        toolResults.push({ name: call.name, result });
        await supabase.from('ai_messages').insert({
          conversation_id: conversation.id,
          hotel_id: hotelId,
          role: 'tool',
          content: `Executed ${call.name}`,
          tool_name: call.name,
          tool_calls: { name: call.name, args: call.args || {} },
          tool_result: result,
          direction: 'internal',
          delivery_status: 'sent'
        });
        history.push({ role: 'assistant', content: '', _functionCall: call });
      }

      aiResponse = await submitToolResponseToGemini(
        systemPrompt, history, toolResults, geminiToolsDefinition, apiKey
      );
    }

    if (!finalResponseText.trim()) finalResponseText = 'No pude completar la solicitud. Te comunicaré con recepción.';
    const initialDeliveryStatus = isTrustedChannelRequest
      ? 'processing'
      : channelDelaySeconds > 0 ? 'delayed' : 'sent';
    const { data: assistantMessage, error: assistantMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id: hotelId,
      role: 'assistant',
      content: finalResponseText.trim(),
      direction: 'outbound',
      delivery_status: initialDeliveryStatus
    }).select('id').single();
    if (assistantMessageError) throw assistantMessageError;

    if (!isTrustedChannelRequest && channelDelaySeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(channelDelaySeconds, 30) * 1000));
      await supabase.from('ai_messages').update({ delivery_status: 'sent' }).eq('id', assistantMessage.id);
    }

    await supabase.from('ai_conversations').update({
      last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id);
    const { data: updatedConversation } = await supabase
      .from('ai_conversations').select('status,journey_stage,reserva_id').eq('id', conversation.id).single();

    return jsonResponse({
      conversation_id: conversation.id,
      response: finalResponseText.trim(),
      status: updatedConversation?.status || conversation.status,
      journey_stage: updatedConversation?.journey_stage || conversation.journey_stage,
      reservation_id: updatedConversation?.reserva_id || null,
      delivery: {
        message_id: assistantMessage.id,
        delay_seconds: isTrustedChannelRequest ? channelDelaySeconds : 0,
        status: isTrustedChannelRequest ? 'processing' : 'sent'
      }
    });
  } catch (error: any) {
    console.error('[AI Gateway Error]', error);
    return errorResponse('Could not process the conversation', 500);
  }
});
