// supabase/functions/ai-gateway-llm/index.ts
// Orquestación LLM: llamada al modelo, ejecución de tools, respuesta final

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { uuidPattern } from "./_shared/crypto.ts";
import { protectCurrentPII, sanitizeForModel, redactPII } from "../_shared/pii.ts";
import { buildSystemPrompt } from "../ai-gateway/prompts.ts";
import { geminiToolsDefinition, ToolExecutor } from "../ai-gateway/tools.ts";
import { createSession, callModel, submitToolResults, resolveProvider, resolveApiKey } from "../ai-gateway/llm.ts";
import type { ModelMessage, OpenAiTool } from "../ai-gateway/llm.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = crypto.randomUUID();
  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return errorResponse('Invalid JSON body', 400); }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Required fields
    const conversationId = String(body.conversation_id || '');
    const userMessageId = String(body.user_message_id || '');
    const hotelId = String(body.hotel_id || '');
    const protectedMessage = body.protected_message; // { text, vault }
    const vault = body.vault || {};
    const history = body.history || [];
    const config = body.config;
    const channelDelaySeconds = Number(body.channel_delay_seconds || 0);
    const isTrustedChannelRequest = Boolean(body.is_trusted_channel);

    if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
    if (!uuidPattern.test(userMessageId)) return errorResponse('Invalid user_message_id', 400);
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);
    if (!protectedMessage?.text) return errorResponse('Missing protected_message', 400);

    // Load hotel config and knowledge
    const { data: configData, error: configError } = await supabase
      .from('ai_hotel_config').select('*').eq('hotel_id', hotelId).single();
    if (configError || !configData) return errorResponse('Hotel configuration not found', 404);

    const { data: knowledge } = await supabase
      .from('ai_hotel_knowledge').select('*').eq('hotel_id', hotelId).eq('activo', true)
      .order('priority', { ascending: false }).limit(100);

    // Build system prompt
    const systemPrompt = `${buildSystemPrompt(configData, knowledge || [])}\nLos marcadores [PII_*] representan datos reales protegidos. Consérvalos exactamente al pasarlos a herramientas; nunca los repitas en la respuesta.`;

    // Prepare tools (Gemini -> OpenAI format)
    const openAiTools: OpenAiTool[] = (geminiToolsDefinition[0]?.functionDeclarations || []).map((decl: any) => ({
      type: 'function',
      function: { name: decl.name, description: decl.description, parameters: decl.parameters },
    }));

    // Build messages
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.slice(0, -1).map((entry: any) => ({
        role: entry.role === 'assistant' ? 'assistant' : 'user',
        content: String(entry.content || ''),
      })),
      { role: 'user', content: protectedMessage.text },
    ];

    // Resolve provider and API key
    const provider = resolveProvider();
    const apiKey = resolveApiKey(provider);
    if (!apiKey) return errorResponse('AI model is not configured', 503);

    // Create session and call model
    const session = createSession(provider, messages, openAiTools);
    let reply = await callModel(session, apiKey);
    let finalResponseText = '';
    const executor = new ToolExecutor(supabase, hotelId, conversationId, vault);

    for (let iteration = 0; iteration < 5; iteration++) {
      if (reply.text) finalResponseText += reply.text;
      const calls = reply.toolCalls;
      if (!calls.length) break;

      const toolResults = [];
      for (const call of calls) {
        const result = await executor.executeTool(call.name, call.args || {});
        const safeResult = sanitizeForModel(result);
        toolResults.push({ id: call.id, name: call.name, result: safeResult });
        await supabase.from('ai_messages').insert({
          conversation_id: conversationId, hotel_id: hotelId, role: 'tool',
          content: `Executed ${call.name}`, tool_name: call.name,
          tool_calls: { name: call.name, args: sanitizeForModel(call.args || {}) },
          tool_result: safeResult, direction: 'internal', delivery_status: 'sent'
        });
      }
      reply = await submitToolResults(session, toolResults, apiKey);
    }

    if (!finalResponseText.trim()) finalResponseText = 'No pude completar la solicitud. Te comunicaré con recepción.';

    // Insert assistant message
    const initialDeliveryStatus = isTrustedChannelRequest ? 'queued' : 'sent';
    const { data: assistantMessage, error: assistantMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversationId, hotel_id: hotelId, role: 'assistant',
      content: finalResponseText.trim(), direction: 'outbound',
      delivery_status: initialDeliveryStatus, reply_to_message_id: userMessageId,
      next_attempt_at: new Date(Date.now() + Math.max(0, channelDelaySeconds) * 1000).toISOString(),
    }).select('id').single();

    // Update conversation
    await supabase.from('ai_conversations').update({
      last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversationId);

    return jsonResponse({
      conversation_id: conversationId,
      response: finalResponseText.trim(),
      delivery: { message_id: assistantMessage.id, delay_seconds: channelDelaySeconds, status: initialDeliveryStatus }
    });
  } catch (error: any) {
    console.error('[LLM Orchestration Error]', error);
    return errorResponse('Could not process the conversation', 500);
  }
});