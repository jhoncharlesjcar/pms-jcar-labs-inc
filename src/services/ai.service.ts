import { supabase } from '@/config/supabase';
import {
  AIHotelConfig,
  AIKnowledge,
  AIConversation,
  AIMessage,
  AIMetrics
} from '@/types/ai.types';

export const AIService = {
  // --------------------------------------------------------
  // GATEWAY PÚBLICO (Para el Widget)
  // --------------------------------------------------------
  async bootstrapSession(hotelId: string, sessionId?: string, sessionToken?: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const url = `${supabaseUrl}/functions/v1/ai-gateway`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        action: 'bootstrap', hotel_id: hotelId,
        session_id: sessionId, session_token: sessionToken
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al iniciar la conversación');
    }

    return response.json();
  },

  async sendMessage(hotelId: string, sessionId: string, sessionToken: string, message: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const response = await fetch(`${supabaseUrl}/functions/v1/ai-gateway`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({
        action: 'message', hotel_id: hotelId, session_id: sessionId,
        session_token: sessionToken, message, channel: 'web'
      })
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al enviar mensaje');
    }
    return response.json();
  },

  // --------------------------------------------------------
  // ADMINISTRACIÓN (Panel Staff)
  // --------------------------------------------------------

  // --- CONFIGURACIÓN ---
  async getConfig(hotelId: string): Promise<AIHotelConfig> {
    const { data, error } = await supabase
      .from('ai_hotel_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .maybeSingle();

    if (error) throw error;
    
    if (!data) {
      // Default creation
      const { data: newConfig, error: insertError } = await supabase
        .from('ai_hotel_config')
        .insert({ hotel_id: hotelId })
        .select('*')
        .single();
      
      if (insertError) throw insertError;
      return newConfig as AIHotelConfig;
    }

    return data as AIHotelConfig;
  },

  async updateConfig(hotelId: string, updates: Partial<AIHotelConfig>): Promise<AIHotelConfig> {
    const { data, error } = await supabase
      .from('ai_hotel_config')
      .update(updates)
      .eq('hotel_id', hotelId)
      .select('*')
      .single();

    if (error) throw error;
    return data as AIHotelConfig;
  },

  // --- BASE DE CONOCIMIENTO ---
  async getKnowledge(hotelId: string): Promise<AIKnowledge[]> {
    const { data, error } = await supabase
      .from('ai_hotel_knowledge')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('priority', { ascending: false });

    if (error) throw error;
    return data as AIKnowledge[];
  },

  async upsertKnowledge(hotelId: string, item: Partial<AIKnowledge>): Promise<AIKnowledge> {
    const { data, error } = await supabase
      .from('ai_hotel_knowledge')
      .upsert({ ...item, hotel_id: hotelId })
      .select('*')
      .single();

    if (error) throw error;
    return data as AIKnowledge;
  },

  async deleteKnowledge(id: string): Promise<void> {
    const { error } = await supabase
      .from('ai_hotel_knowledge')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // --- CANALES ---
  async getChannelConnections(hotelId: string) {
    const { data, error } = await supabase
      .from('ai_channel_connections')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('channel');
    if (error) throw error;
    return data || [];
  },

  async saveChannelConnection(hotelId: string, channel: string, updates: Record<string, unknown>) {
    const { data, error } = await supabase.rpc('ai_upsert_channel_connection', {
      p_hotel_id: hotelId,
      p_channel: channel,
      p_name: String(updates.name || channel),
      p_external_account_id: updates.external_account_id ? String(updates.external_account_id) : null,
      p_enabled: updates.enabled === true,
      p_response_delay_seconds: Number(updates.response_delay_seconds || 0),
      p_max_concurrent_messages: Number(updates.max_concurrent_messages || 1),
      p_public_config: updates.public_config || {},
    });
    if (error) throw error;
    return data;
  },

  // --- CONVERSACIONES ---
  async getConversations(hotelId: string, statusFilter?: string): Promise<AIConversation[]> {
    let query = supabase
      .from('ai_conversations')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('updated_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as AIConversation[];
  },

  async getMessages(conversationId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('ai_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data as AIMessage[];
  },

  async getConversation(conversationId: string): Promise<AIConversation> {
    const { data, error } = await supabase.from('ai_conversations').select('*').eq('id', conversationId).single();
    if (error) throw error;
    return data as AIConversation;
  },

  async takeoverConversation(conversationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .update({
        status: 'handed_off',
        human_controlled: true, assigned_user_id: userId
      })
      .eq('id', conversationId);

    if (error) throw error;
  },

  async releaseConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .update({
        status: 'active',
        human_controlled: false, assigned_user_id: null
      })
      .eq('id', conversationId);
    if (error) throw error;
  },

  async sendHumanMessage(conversationId: string, content: string): Promise<AIMessage> {
    const { data, error } = await supabase.rpc('ai_send_human_message', {
      p_conversation_id: conversationId,
      p_content: content.trim(),
    });
    if (error) throw error;
    return (data?.message || data) as AIMessage;
  },

  async checkChannelHealth(connectionId: string) {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: { action: 'channel_healthcheck', connection_id: connectionId },
    });
    if (error) throw error;
    if (!data || data.error) throw new Error(data?.error || 'El conector no respondió');
    return data;
  },

  async provisionChannelCredential(connectionId: string) {
    const { data, error } = await supabase.functions.invoke('ai-gateway', {
      body: { action: 'provision_channel_credential', connection_id: connectionId },
    });
    if (error) throw error;
    if (!data || data.error || !data.credential_id || !data.secret) {
      throw new Error(data?.error || 'No se pudo provisionar la credencial');
    }
    return data as { credential_id: string; secret: string; credential_version?: number };
  },

  async getBookingContext(conversationId: string) {
    const [intents, holds, payments] = await Promise.all([
      supabase.from('ai_booking_intents').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1),
      supabase.from('ai_reservation_holds').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1),
      supabase.from('ai_payment_intents').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1),
    ]);
    if (intents.error) throw intents.error;
    if (holds.error) throw holds.error;
    if (payments.error) throw payments.error;
    const payment = payments.data?.[0] || null;
    let evidence: any[] = [];
    if (payment?.id) {
      const { data, error } = await supabase.from('ai_manual_payment_evidence')
        .select('id,object_path,content_sha256,observed_amount,observed_at,submitted_by,verified_at,created_at')
        .eq('payment_intent_id', payment.id).order('created_at', { ascending: false });
      if (error) throw error;
      evidence = data || [];
    }
    return {
      intent: intents.data?.[0] || null,
      hold: holds.data?.[0] || null,
      payment,
      evidence,
    };
  },

  async verifyManualPayment(paymentIntentId: string, reference: string, evidenceId: string): Promise<string> {
    const { data, error } = await supabase.rpc('ai_verify_manual_payment', {
      p_payment_intent_id: paymentIntentId,
      p_reference: reference,
      p_evidence: { evidence_id: evidenceId },
    });
    if (error) throw error;
    return data as string;
  },

  async getPaymentEvidenceReview(evidenceId: string) {
    const { data, error } = await supabase.functions.invoke('review-payment-evidence', {
      body: { evidence_id: evidenceId },
    });
    if (error) throw error;
    if (!data?.signed_url) throw new Error('No se pudo obtener la evidencia');
    return data as { signed_url: string; expires_in_seconds: number };
  },

  // --- MÉTRICAS ---
  async getMetrics(hotelId: string): Promise<AIMetrics> {
    const { data, error } = await supabase
        .from('v_ai_hotel_metrics')
        .select('*')
        .eq('hotel_id', hotelId)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
             return {
                totalConversations: 0,
                opportunities: 0,
                quotes: 0,
                reservations: 0,
                conversionRate: 0,
                revenue: 0
             };
        }
        throw error;
    }
    return {
        totalConversations: data.total_conversations,
        opportunities: data.opportunities,
        quotes: data.total_quotes,
        reservations: data.reservations,
        conversionRate: data.conversion_rate,
        revenue: data.revenue,
    };
  }
};
