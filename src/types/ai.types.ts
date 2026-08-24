export interface AIHotelConfig {
  id?: string;
  hotel_id: string;
  agent_enabled: boolean;
  agent_name: string;
  agent_personality: string;
  welcome_message: string;
  languages: string[];
  operating_hours: { "24_7": boolean; [key: string]: any };
  handoff_message: string;
  max_concurrent_conversations: number;
  auto_followup_enabled: boolean;
  upselling_enabled: boolean;
  response_delay_seconds?: number;
  quote_validity_minutes: number;
  hold_minutes: number;
  deposit_type: 'full' | 'percentage' | 'fixed';
  deposit_value: number;
  max_discount_percent: number;
  payment_instructions: Record<string, unknown>;
  abandoned_followup_minutes: number;
  reception_agent_enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AIKnowledge {
  id?: string;
  hotel_id: string;
  category: 'general' | 'servicios' | 'politicas' | 'ubicacion' | 'faq' | 'amenidades' | 'transporte' | 'alrededores';
  title: string;
  content: string;
  priority: number;
  activo: boolean;
  created_at?: string;
}

export interface AIConversation {
  id: string;
  hotel_id: string;
  channel: 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'guest_portal' | 'manual';
  session_id: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  status: 'active' | 'quoted' | 'payment_pending' | 'booked' | 'handed_off' | 'abandoned' | 'closed';
  journey_stage?: string;
  human_controlled?: boolean;
  external_account_id?: string;
  external_contact_id?: string;
  last_inbound_at?: string;
  last_outbound_at?: string;
  intent?: string;
  metadata: any;
  assigned_user_id?: string;
  reserva_id?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  hotel_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any;
  tool_name?: string;
  tool_result?: any;
  tokens_used?: number;
  created_at: string;
}

export interface AIBookingIntent {
  id: string;
  hotel_id: string;
  conversation_id: string;
  status: 'qualified' | 'quote_created' | 'quote_accepted' | 'guest_data_pending' | 'hold_active' | 'payment_pending' | 'confirmed' | 'abandoned' | 'cancelled';
  fecha_entrada: string;
  fecha_salida: string;
  adultos: number;
  ninos: number;
  selected_room_id?: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  guest_document?: string;
  source_channel: string;
}

export interface AIReservationHold {
  id: string;
  quote_id: string;
  habitacion_id: string;
  status: 'active' | 'payment_pending' | 'converted' | 'expired' | 'cancelled';
  expires_at: string;
  reservation_id?: string;
}

export interface AIPaymentIntent {
  id: string;
  hold_id: string;
  method: 'gateway' | 'yape' | 'plin' | 'transferencia' | 'tarjeta' | 'efectivo';
  provider: string;
  status: 'created' | 'pending' | 'awaiting_manual_review' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded';
  amount: number;
  currency: string;
  instructions: Record<string, unknown>;
  expires_at: string;
  reservation_id?: string;
}

export interface AIQuote {
  id: string;
  hotel_id: string;
  conversation_id: string;
  room_type: string;
  habitacion_id: string;
  fecha_entrada: string;
  fecha_salida: string;
  noches: number;
  adultos: number;
  ninos: number;
  precio_noche: number;
  total: number;
  currency: string;
  status: 'pending' | 'accepted' | 'expired' | 'rejected';
  expires_at?: string;
  created_at: string;
}

export interface AIMetrics {
  totalConversations: number;
  opportunities: number;
  quotes: number;
  reservations: number;
  conversionRate: number;
  revenue: number;
}

export interface AIChannelConnection {
  id?: string;
  hotel_id: string;
  channel: 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'guest_portal';
  name: string;
  external_account_id?: string;
  status: 'connected' | 'degraded' | 'disconnected' | 'paused';
  enabled: boolean;
  response_delay_seconds: number;
  max_concurrent_messages: number;
  public_config: Record<string, unknown>;
  last_healthcheck_at?: string;
  last_error?: string;
}
