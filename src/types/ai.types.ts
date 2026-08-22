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
  channel: 'web' | 'manual';
  session_id: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  status: 'active' | 'quoted' | 'booked' | 'handed_off' | 'abandoned' | 'closed';
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
