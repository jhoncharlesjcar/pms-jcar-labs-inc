import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { AIGatewayRequest, AIGatewayResponse } from "./types.ts";
import { buildSystemPrompt } from "./prompts.ts";
import { geminiToolsDefinition, ToolExecutor } from "./tools.ts";
import { callGemini, submitToolResponseToGemini } from "./gemini.ts";

declare const Deno: any;

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse("Method Not Allowed", 405);
  }

  try {
    const body: AIGatewayRequest = await req.json();
    const { hotel_id, session_id, message } = body;

    if (!hotel_id || !session_id || !message) {
      return errorResponse("Missing required fields", 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Validar hotel y configuración
    const { data: config, error: configError } = await supabase
      .from('ai_hotel_config')
      .select('*')
      .eq('hotel_id', hotel_id)
      .single();

    if (configError || !config) {
      return errorResponse("Hotel configuration not found", 404);
    }

    if (!config.agent_enabled) {
      return errorResponse("Agent is currently disabled", 403);
    }

    // 2. Obtener o crear conversación
    let { data: conversation, error: convError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('session_id', session_id)
      .single();

    if (!conversation) {
      const { data: newConv, error: createError } = await supabase
        .from('ai_conversations')
        .insert({
          hotel_id,
          session_id,
          channel: 'web',
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      conversation = newConv;

      // Generar mensaje inicial del asistente (opcional, aquí sólo grabamos)
      await supabase.from('ai_messages').insert({
        conversation_id: conversation.id,
        hotel_id,
        role: 'assistant',
        content: config.welcome_message
      });
    }

    if (conversation.status === 'handed_off' || conversation.status === 'closed') {
      return new Response(JSON.stringify({ 
        conversation_id: conversation.id, 
        response: config.handoff_message,
        status: conversation.status
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Grabar mensaje del usuario
    await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id,
      role: 'user',
      content: message
    });

    // 4. Obtener historial reciente (últimos 10 mensajes)
    const { data: historyData } = await supabase
      .from('ai_messages')
      .select('role, content')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    const history = (historyData || []).reverse(); // Orden cronológico

    // 5. Cargar knowledge base
    const { data: knowledge } = await supabase
      .from('ai_hotel_knowledge')
      .select('*')
      .eq('hotel_id', hotel_id)
      .eq('activo', true)
      .order('priority', { ascending: false });

    // 6. Construir System Prompt
    const systemPrompt = buildSystemPrompt(config, knowledge || []);

    // 7. Llamar a Gemini (Turno 1)
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    let aiResponse = await callGemini(systemPrompt, history.slice(0, -1), message, geminiToolsDefinition, apiKey);
    let finalResponseText = '';
    
    // Loop de Tool Calling (máx 3 iteraciones para evitar infinitos)
    let iter = 0;
    while (iter < 3) {
      iter++;
      const candidate = aiResponse.candidates?.[0];
      if (!candidate) break;

      const parts = candidate.content.parts;
      
      // Buscar si Gemini ejecutó una función (tool call)
      const functionCallPart = parts.find((p: any) => p.functionCall);
      const textPart = parts.find((p: any) => p.text);

      if (textPart) {
        finalResponseText += textPart.text;
      }

      if (functionCallPart) {
        const { name, args } = functionCallPart.functionCall;
        
        // Ejecutar tool
        const executor = new ToolExecutor(supabase, hotel_id, conversation.id);
        const result = await executor.executeTool(name, args);
        
        // Guardar tool message (para historial)
        await supabase.from('ai_messages').insert({
          conversation_id: conversation.id,
          hotel_id,
          role: 'tool',
          content: `Executed ${name}`,
          tool_name: name,
          tool_calls: { name, args },
          tool_result: result
        });

        // Enviar resultado de vuelta a Gemini para que genere la respuesta final
        // Gemini necesita functionCall y functionResponse en el history
        // Aquí agregamos la llamada de modelo y la respuesta de usuario
        history.push({ role: 'assistant', content: '', _functionCall: functionCallPart.functionCall });
        
        aiResponse = await submitToolResponseToGemini(
          systemPrompt,
          history.slice(0, -1), // Sin el último porque ya lo pasamos en contents
          [{ name, result }],
          geminiToolsDefinition,
          apiKey
        );
        
      } else {
        // No hay function calls, terminamos el loop
        break;
      }
    }

    if (!finalResponseText) {
      finalResponseText = "Lo siento, tuve un problema procesando tu solicitud.";
    }

    // 8. Grabar respuesta final del asistente
    await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id,
      role: 'assistant',
      content: finalResponseText
    });

    // 9. Refrescar estado de la conversación (pudo cambiar en un tool)
    const { data: updatedConv } = await supabase
      .from('ai_conversations')
      .select('status, metadata')
      .eq('id', conversation.id)
      .single();

    // 10. Aplicar retraso artificial si está configurado (Anti-Ban WhatsApp)
    if (config.response_delay_seconds && config.response_delay_seconds > 0) {
      await new Promise(resolve => setTimeout(resolve, config.response_delay_seconds * 1000));
    }

    return new Response(JSON.stringify({
      conversation_id: conversation.id,
      response: finalResponseText,
      status: updatedConv?.status || 'active'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[AI Gateway Error]', error);
    return errorResponse(error.message || "Internal Server Error", 500);
  }
});
