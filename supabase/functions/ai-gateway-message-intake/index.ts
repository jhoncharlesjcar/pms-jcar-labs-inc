// supabase/functions/ai-gateway-message-intake/index.ts
// Recepción de mensajes (web y canales externos)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { authenticateChannelRequest } from "../_shared/channel-auth.ts";
import { uuidPattern } from "./_shared/crypto.ts";
import { protectCurrentPII, sanitizeForModel, redactPII } from "../_shared/pii.ts";
import { logEvent, requestId } from "../_shared/runtime.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = requestId(req);
  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return errorResponse('Invalid JSON body', 400); }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const { data: config, error: configError } = await supabase
      .from('ai_hotel_config').select('*').eq('hotel_id', hotelId).single();
    if (configError || !config) return errorResponse('Hotel configuration not found', 404);

    // Handle duplicate check for external channels
    const channel = body.channel || 'web';
    const isExternalChannel = ['whatsapp', 'instagram', 'facebook', 'guest_portal'].includes(channel);
    const signedCredential = isExternalChannel ? await authenticateChannelRequest(supabase, req, await req.text()) : null;
    const isTrustedChannelRequest = Boolean(signedCredential)
      && signedCredential.hotel_id === hotelId
      && signedCredential.channel === channel
      && signedCredential.enabled === true
      && ['connected', 'degraded'].includes(String(signedCredential.status || ''));

    if (isExternalChannel && !isTrustedChannelRequest) return errorResponse('Invalid channel credentials', 401);

    // Rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
    const rateIdentity = isTrustedChannelRequest ? `${channel}:${String(body.external_contact_id || '').trim()}` : clientIp;
    const ipHash = await sha256(`ai:${rateIdentity}:${hotelId}`);
    const { data: allowed, error: rateError } = await supabase.rpc('check_booking_rate_limit', {
      p_ip_hash: ipHash, p_max_attempts: 30, p_window_seconds: 300
    });
    if (rateError || allowed === false) return errorResponse('Too many messages. Try again shortly.', 429);

    // Handle message intake
    const externalAccountId = String(body.external_account_id || '').trim();
    const externalContactId = String(body.external_contact_id || '').trim();
    const externalMessageId = String(body.external_message_id || '').trim();
    let sessionId = String(body.session_id || '');
    const sessionToken = String(body.session_token || '');
    const message = String(body.message || '').trim();

    if (isTrustedChannelRequest) {
      if (!externalAccountId) return errorResponse('Missing external account identifier', 400);
      if (externalAccountId !== signedCredential.external_account_id) return errorResponse('Channel account mismatch', 403);
      if (!['delivery_status', 'pull_outbound', 'ack_outbound', 'nack_outbound', 'pull_events', 'ack_event', 'nack_event', 'submit_payment_evidence'].includes(body.action || 'message')
        && (!externalContactId || !externalMessageId || !message)) {
        return errorResponse('Missing normalized channel fields', 400);
      }
    } else {
      if (!uuidPattern.test(sessionId) || !sessionToken || !message) return errorResponse('Missing required fields', 400);
      const { data: validatedSession, error: sessionError } = await supabase.rpc('ai_validate_client_session', {
        p_hotel_id: hotelId, p_session_token: sessionToken,
      });
      if (sessionError || validatedSession?.session_id !== sessionId || validatedSession?.channel !== 'web') {
        return errorResponse('Invalid conversation session', 401);
      }
    }

    if (message.length > 2000) return errorResponse('Message is too long', 413);

    // Duplicate check for external channels
    if (isTrustedChannelRequest) {
      const { data: duplicate } = await supabase.from('ai_messages')
        .select('id,conversation_id').eq('hotel_id', hotelId).eq('external_message_id', externalMessageId).maybeSingle();
      if (duplicate) {
        const { data: previousResponse } = await supabase.from('ai_messages').select('id,content,delivery_status')
          .eq('conversation_id', duplicate.conversation_id).eq('reply_to_message_id', duplicate.id)
          .eq('role', 'assistant').maybeSingle();
        return jsonResponse({ duplicate: true, conversation_id: duplicate.conversation_id, response: null });
      }
    }

    // Find or create conversation
    let conversationQuery = supabase.from('ai_conversations').select('*').eq('hotel_id', hotelId);
    conversationQuery = isTrustedChannelRequest
      ? conversationQuery.eq('channel', channel).eq('external_account_id', externalAccountId)
        .eq('external_contact_id', externalContactId).not('status', 'in', '(closed,abandoned)')
      : conversationQuery.eq('session_id', sessionId);

    const { data: existingConversation } = await conversationQuery.maybeSingle();
    let conversation = existingConversation;

    if (!conversation) {
      const { data: created, error: createError } = await supabase.from('ai_conversations').insert({
        hotel_id: hotelId, session_id: sessionId, channel,
        external_account_id: isTrustedChannelRequest ? externalAccountId : null,
        external_contact_id: isTrustedChannelRequest ? externalContactId : null,
        status: 'active', journey_stage: 'lead', last_inbound_at: new Date().toISOString()
      }).select().single();
      if (createError) throw createError;
      conversation = created;
    }

    // Insert user message
    const { data: userMessage, error: userMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversation.id, hotel_id: hotelId, role: 'user', content: message,
      direction: 'inbound', delivery_status: 'received',
      external_message_id: isTrustedChannelRequest ? externalMessageId : null
    }).select('id').single();
    if (userMessageError) throw userMessageError;

    await supabase.from('ai_conversations').update({
      last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id);

    // Return conversation info for LLM processing
    const { data: historyData } = await supabase.from('ai_messages')
      .select('role,content').eq('conversation_id', conversation.id)
      .in('role', ['user', 'assistant']).order('created_at', { ascending: false }).limit(20);
    const history = (historyData || []).reverse();
    const modelHistory = history.map((entry: any) => ({ ...entry, content: redactPII(String(entry.content || '')) }));
    const protectedMessage = protectCurrentPII(message, conversation.journey_stage);

    return jsonResponse({
      conversation_id: conversation.id,
      user_message_id: userMessage.id,
      session_id: conversation.session_id,
      channel,
      history: modelHistory,
      protected_message: protectedMessage.text,
      vault: protectedMessage.vault,
      config: {
        agent_enabled: config.agent_enabled,
        agent_name: config.agent_name,
        welcome_message: config.welcome_message,
        languages: config.languages,
        operating_hours: config.operating_hours
      }
    });
  } catch (error: any) {
    console.error('[Message Intake Error]', error);
    return errorResponse('Could not process message', 500);
  }
});