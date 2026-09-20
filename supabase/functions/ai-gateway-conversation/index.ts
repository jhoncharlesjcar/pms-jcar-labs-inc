// supabase/functions/ai-gateway-conversation/index.ts
// Gestión de conversaciones (CRUD, takeover, human handoff)

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
    try { body = JSON.parse(rawBody); } catch { return errorResponse('Invalid JSON body', 400); }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const auth = await authenticateRequest(req);
    if (auth.error || !auth.user) return errorResponse(auth.error || 'Unauthorized', auth.status);

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);
    if (auth.user.role !== 'developer' && auth.user.hotel_id !== hotelId) {
      return errorResponse('Cross-tenant access denied', 403);
    }

    const action = body.action;

    // Get conversations list
    if (action === 'list') {
      const statusFilter = body.status_filter;
      let query = supabase.from('ai_conversations')
        .select('*').eq('hotel_id', hotelId).order('updated_at', { ascending: false });
      if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return jsonResponse({ conversations: data || [] });
    }

    // Get single conversation with messages
    if (action === 'get') {
      const conversationId = String(body.conversation_id || '');
      if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
      
      const { data: conversation, error: convError } = await supabase.from('ai_conversations')
        .select('*').eq('id', conversationId).eq('hotel_id', hotelId).single();
      if (convError || !conversation) return errorResponse('Conversation not found', 404);

      const { data: messages, error: msgError } = await supabase.from('ai_messages')
        .select('*').eq('conversation_id', conversationId).eq('hotel_id', hotelId)
        .order('created_at', { ascending: true });
      if (msgError) throw msgError;

      return jsonResponse({ conversation, messages: messages || [] });
    }

    // Takeover conversation (human agent)
    if (action === 'takeover') {
      const conversationId = String(body.conversation_id || '');
      if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
      
      const { error } = await supabase.from('ai_conversations').update({
        status: 'handed_off', human_controlled: true, assigned_user_id: auth.user.id
      }).eq('id', conversationId).eq('hotel_id', hotelId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // Release conversation (back to AI)
    if (action === 'release') {
      const conversationId = String(body.conversation_id || '');
      if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
      
      const { error } = await supabase.from('ai_conversations').update({
        status: 'active', human_controlled: false, assigned_user_id: null
      }).eq('id', conversationId).eq('hotel_id', hotelId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    // Send human message
    if (action === 'send_human_message') {
      const conversationId = String(body.conversation_id || '');
      const content = String(body.content || '').trim();
      if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
      if (!content) return errorResponse('Content is required', 400);
      
      const { data, error } = await supabase.rpc('ai_send_human_message', {
        p_conversation_id: conversationId, p_content: content,
      });
      if (error) throw error;
      return jsonResponse({ message: data?.message || data });
    }

    // Close/abandon conversation
    if (action === 'close') {
      const conversationId = String(body.conversation_id || '');
      if (!uuidPattern.test(conversationId)) return errorResponse('Invalid conversation_id', 400);
      
      const { error } = await supabase.from('ai_conversations').update({
        status: 'closed', updated_at: new Date().toISOString()
      }).eq('id', conversationId).eq('hotel_id', hotelId);
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    return errorResponse('Unknown action', 400);
  } catch (error: any) {
    console.error('[Conversation Error]', error);
    return errorResponse('Could not process request', 500);
  }
});