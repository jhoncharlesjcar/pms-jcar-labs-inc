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
    const { data: existing, error: findError } = await supabase
      .from('ai_channel_connections')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('channel', channel)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;

    const payload = { ...updates, hotel_id: hotelId, channel, updated_at: new Date().toISOString() };
    const query = existing
      ? supabase.from('ai_channel_connections').update(payload).eq('id', existing.id)
      : supabase.from('ai_channel_connections').insert(payload);
    const { data, error } = await query.select('*').single();
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

  async takeoverConversation(conversationId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .update({
        status: 'handed_off', journey_stage: 'handed_off',
        human_controlled: true, assigned_user_id: userId
      })
      .eq('id', conversationId);

    if (error) throw error;
  },

  async releaseConversation(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('ai_conversations')
      .update({
        status: 'active', journey_stage: 'lead',
        human_controlled: false, assigned_user_id: null
      })
      .eq('id', conversationId);
    if (error) throw error;
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
    return {
      intent: intents.data?.[0] || null,
      hold: holds.data?.[0] || null,
      payment: payments.data?.[0] || null,
    };
  },

  async verifyManualPayment(paymentIntentId: string, reference: string): Promise<string> {
    const { data, error } = await supabase.rpc('ai_verify_manual_payment', {
      p_payment_intent_id: paymentIntentId,
      p_reference: reference,
    });
    if (error) throw error;
    return data as string;
  },

  // --- MÉTRICAS ---
  async getMetrics(hotelId: string): Promise<AIMetrics> {
    // Simplicación para el MVP, en producción sería mejor una vista o función SQL
    const { data: convs, error: cError } = await supabase
      .from('ai_conversations')
      .select('status')
      .eq('hotel_id', hotelId);

    if (cError) throw cError;

    const { data: payments, error: qError } = await supabase
      .from('ai_payment_intents')
      .select('amount, status, reservation_id')
      .eq('hotel_id', hotelId);

    if (qError) throw qError;

    const totalConversations = convs.length;
    const opportunities = convs.filter(c => c.status !== 'closed' && c.status !== 'abandoned').length;
    const { count: quotesCount = 0, error: quoteCountError } = await supabase
      .from('ai_quotes')
      .select('*', { count: 'exact', head: true })
      .eq('hotel_id', hotelId);
    if (quoteCountError) throw quoteCountError;
    const reservations = convs.filter(c => c.status === 'booked').length;
    const revenue = payments
      .filter(payment => payment.status === 'paid' && payment.reservation_id)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);

    const conversionRate = totalConversations > 0 ? (reservations / totalConversations) * 100 : 0;

    return {
      totalConversations,
      opportunities,
      quotes: quotesCount,
      reservations,
      conversionRate: Math.round(conversionRate * 10) / 10,
      revenue
    };
  }
};
