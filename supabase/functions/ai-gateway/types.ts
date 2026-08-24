export interface AIGatewayRequest {
  action?: 'bootstrap' | 'message' | 'delivery_status' | 'pull_outbound';
  hotel_id: string;
  session_id?: string;
  session_token?: string;
  message?: string;
  channel?: 'web' | 'whatsapp' | 'instagram' | 'facebook' | 'guest_portal';
  external_account_id?: string;
  external_contact_id?: string;
  external_message_id?: string;
  delivery_message_id?: string;
  delivery_status?: 'sent' | 'delivered' | 'read' | 'failed';
  error_code?: string;
  limit?: number;
}

export interface AIGatewayResponse {
  conversation_id: string;
  response: string;
  status: string;
  quote?: any;
  reservation?: any;
}

export interface AIHotelConfig {
  id: string;
  hotel_id: string;
  agent_enabled: boolean;
  agent_name: string;
  agent_personality: string;
  welcome_message: string;
  languages: string[];
  operating_hours: any;
  handoff_message: string;
  response_delay_seconds?: number;
  quote_validity_minutes?: number;
  hold_minutes?: number;
  deposit_type?: 'full' | 'percentage' | 'fixed';
  deposit_value?: number;
}

export interface AIKnowledge {
  id: string;
  category: string;
  title: string;
  content: string;
}

export interface AIConversation {
  id: string;
  hotel_id: string;
  channel: string;
  session_id: string;
  guest_name?: string;
  guest_phone?: string;
  guest_email?: string;
  status: string;
  intent?: string;
  metadata: any;
  journey_stage?: string;
  human_controlled?: boolean;
}
