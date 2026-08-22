export interface AIGatewayRequest {
  hotel_id: string;
  session_id: string;
  message: string;
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
}
