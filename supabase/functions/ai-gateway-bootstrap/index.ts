// supabase/functions/ai-gateway-bootstrap/index.ts
// Bootstrap de sesiones de cliente web

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { uuidPattern } from "./_shared/crypto.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = crypto.randomUUID();
  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const { data: config, error: configError } = await supabase
      .from('ai_hotel_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .single();
    if (configError || !config) return errorResponse('Hotel configuration not found', 404);

    const requestedSession = String(body.session_id || '');
    const requestedToken = String(body.session_token || '');
    let validatedSession: any = null;
    if (uuidPattern.test(requestedSession) && requestedToken) {
      const { data } = await supabase.rpc('ai_validate_client_session', {
        p_hotel_id: hotelId,
        p_session_token: requestedToken,
      });
      if (data?.session_id === requestedSession && data?.channel === 'web') validatedSession = data;
    }

    const canReuse = Boolean(validatedSession);
    let sessionId = requestedSession;
    let sessionToken = requestedToken;
    let sessionExpiresAt = validatedSession?.expires_at || null;

    if (!canReuse) {
      const { data: createdSession, error: sessionError } = await supabase.rpc('ai_create_client_session', {
        p_hotel_id: hotelId,
        p_channel: 'web',
        p_conversation_id: null,
        p_ttl_minutes: 1440,
      });
      if (sessionError || !createdSession) throw sessionError || new Error('client_session_creation_failed');
      sessionId = createdSession.session_id;
      sessionToken = createdSession.session_token;
      sessionExpiresAt = createdSession.expires_at;
    }

    let messages: Array<Record<string, unknown>> = [];
    if (canReuse) {
      const { data: previousConversation } = await supabase.from('ai_conversations')
        .select('id').eq('hotel_id', hotelId).eq('session_id', sessionId).maybeSingle();
      if (previousConversation) {
        const { data: transcript } = await supabase.from('ai_messages')
          .select('id,role,content,created_at').eq('hotel_id', hotelId)
          .eq('conversation_id', previousConversation.id).in('role', ['user', 'assistant'])
          .order('created_at', { ascending: false }).limit(50);
        messages = (transcript || []).reverse();
      }
    }

    return jsonResponse({
      session_id: sessionId,
      session_token: sessionToken,
      session_expires_at: sessionExpiresAt,
      messages,
      config: {
        agent_enabled: config.agent_enabled,
        agent_name: config.agent_name,
        welcome_message: config.welcome_message,
        languages: config.languages,
        operating_hours: config.operating_hours
      }
    });
  } catch (error: any) {
    console.error('[AI Gateway Bootstrap Error]', error);
    return errorResponse('Could not bootstrap session', 500);
  }
});