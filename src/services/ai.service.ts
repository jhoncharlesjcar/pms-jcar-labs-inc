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
  async sendMessage(hotelId: string, sessionId: string, message: string) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const url = `${supabaseUrl}/functions/v1/ai-gateway`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      },
      body: JSON.stringify({ hotel_id: hotelId, session_id: sessionId, message })
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
      .update({ status: 'handed_off', assigned_user_id: userId })
      .eq('id', conversationId);

    if (error) throw error;
  },

  // --- MÉTRICAS ---
  async getMetrics(hotelId: string): Promise<AIMetrics> {
    // Simplicación para el MVP, en producción sería mejor una vista o función SQL
    const { data: convs, error: cError } = await supabase
      .from('ai_conversations')
      .select('status')
      .eq('hotel_id', hotelId);

    if (cError) throw cError;

    const { data: quotes, error: qError } = await supabase
      .from('ai_quotes')
      .select('total, status')
      .eq('hotel_id', hotelId);

    if (qError) throw qError;

    const totalConversations = convs.length;
    const opportunities = convs.filter(c => c.status !== 'closed' && c.status !== 'abandoned').length;
    const quotesCount = quotes.length;
    const reservations = convs.filter(c => c.status === 'booked').length;
    
    // Revenue sum of all quotes that lead to booked (status accepted) or just total from quotes that are accepted/booked
    // We will just sum all ai_quotes that have a successful reservation mapping or are just in the system as accepted/booked.
    // In our simplified MVP, we'll count revenue of quotes generated.
    const revenue = quotes
      .filter(q => q.status !== 'rejected' && q.status !== 'expired')
      .reduce((sum, q) => sum + Number(q.total), 0);

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
