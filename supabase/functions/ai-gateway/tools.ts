// @ts-nocheck: Gemini tool arguments are validated again by PostgreSQL RPCs.

export const geminiToolsDefinition = [
  {
    functionDeclarations: [
      {
        name: "search_availability",
        description: "Consulta disponibilidad y tarifas verificadas por el PMS para fechas y ocupantes.",
        parameters: {
          type: "object",
          properties: {
            check_in: { type: "string", description: "Fecha de entrada YYYY-MM-DD" },
            check_out: { type: "string", description: "Fecha de salida YYYY-MM-DD" },
            adults: { type: "integer", description: "Numero de adultos" },
            children: { type: "integer", description: "Numero de ninos" }
          },
          required: ["check_in", "check_out", "adults"]
        }
      },
      {
        name: "create_quote",
        description: "Crea una cotizacion persistida. El servidor recalcula el precio; nunca envies precios inventados.",
        parameters: {
          type: "object",
          properties: {
            habitacion_id: { type: "string", description: "UUID obtenido de search_availability" },
            check_in: { type: "string", description: "Fecha de entrada YYYY-MM-DD" },
            check_out: { type: "string", description: "Fecha de salida YYYY-MM-DD" },
            adults: { type: "integer" },
            children: { type: "integer" }
          },
          required: ["habitacion_id", "check_in", "check_out", "adults"]
        }
      },
      {
        name: "create_reservation_hold",
        description: "Acepta una cotizacion y retiene temporalmente la habitacion mientras se procesa el pago.",
        parameters: {
          type: "object",
          properties: {
            quote_id: { type: "string", description: "UUID retornado por create_quote" },
            guest_name: { type: "string", description: "Nombre completo" },
            guest_phone: { type: "string", description: "Telefono del huesped" },
            guest_document: { type: "string", description: "Documento de identidad" },
            guest_document_type: { type: "string", description: "DNI, CE o pasaporte" },
            guest_email: { type: "string", description: "Correo opcional", nullable: true }
          },
          required: ["quote_id", "guest_name", "guest_phone", "guest_document"]
        }
      },
      {
        name: "create_payment_request",
        description: "Genera instrucciones o una solicitud de pago para un hold activo.",
        parameters: {
          type: "object",
          properties: {
            hold_id: { type: "string", description: "UUID retornado por create_reservation_hold" },
            method: {
              type: "string",
              enum: ["gateway", "yape", "plin", "transferencia", "tarjeta", "efectivo"],
              description: "Metodo elegido por el huesped"
            }
          },
          required: ["hold_id", "method"]
        }
      },
      {
        name: "check_payment_status",
        description: "Consulta el estado real de una solicitud de pago. Esta herramienta nunca confirma pagos.",
        parameters: {
          type: "object",
          properties: { payment_intent_id: { type: "string" } },
          required: ["payment_intent_id"]
        }
      },
      {
        name: "submit_payment_proof",
        description: "Registra que el huesped envio evidencia de un pago manual. No verifica el pago; lo transfiere a recepcion.",
        parameters: {
          type: "object",
          properties: {
            payment_intent_id: { type: "string" },
            reference: { type: "string", description: "Referencia escrita por el huesped", nullable: true }
          },
          required: ["payment_intent_id"]
        }
      },
      {
        name: "get_hotel_policies",
        description: "Consulta politicas, condiciones de reserva, cancelacion y servicios del hotel.",
        parameters: {
          type: "object",
          properties: { topic: { type: "string", description: "Tema solicitado por el huesped" } },
          required: ["topic"]
        }
      },
      {
        name: "get_reservation",
        description: "Consulta la reserva confirmada vinculada a esta conversacion.",
        parameters: { type: "object", properties: {} }
      },
      {
        name: "start_pre_checkin",
        description: "Obtiene el acceso de pre-check-in de una reserva confirmada y avanza la etapa de recepcion.",
        parameters: { type: "object", properties: {} }
      },
      {
        name: "handoff_to_human",
        description: "Transfiere la conversacion a recepcion cuando el cliente lo pide o existe una excepcion.",
        parameters: {
          type: "object",
          properties: { reason: { type: "string" } },
          required: ["reason"]
        }
      }
    ]
  }
];

export class ToolExecutor {
  private toolCallCounts: Map<string, number> = new Map();
  private static readonly TOOL_LIMITS: Record<string, number> = {
    search_availability: 5,
    create_quote: 3,
    create_reservation_hold: 2,
    create_payment_request: 2,
    check_payment_status: 5,
    submit_payment_proof: 2,
    get_hotel_policies: 5,
    get_reservation: 3,
    start_pre_checkin: 1,
    handoff_to_human: 1,
  };

  constructor(
    private supabase: any,
    private hotelId: string,
    private conversationId: string,
    private piiVault: Record<string, string> = {},
  ) {}

  private restoreProtectedValues(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.restoreProtectedValues(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, this.restoreProtectedValues(item)]));
    }
    if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(this.piiVault, value)) {
      return this.piiVault[value];
    }
    return value;
  }

  async executeTool(name: string, args: any): Promise<any> {
    console.log(`[ToolExecutor] Executing ${name}`);
    const count = (this.toolCallCounts.get(name) || 0) + 1;
    const limit = ToolExecutor.TOOL_LIMITS[name] || 3;
    if (count > limit) {
      console.warn(`[ToolExecutor] Rate limit exceeded for ${name}: ${count}/${limit}`);
      return { error: `Límite de uso excedido para ${name}. Transfiriendo a recepción.` };
    }
    this.toolCallCounts.set(name, count);
    try {
      const resolvedArgs = this.restoreProtectedValues(args);
      switch (name) {
        case 'search_availability': return await this.searchAvailability(resolvedArgs);
        case 'create_quote': return await this.createQuote(resolvedArgs);
        case 'create_reservation_hold': return await this.createReservationHold(resolvedArgs);
        case 'create_payment_request': return await this.createPaymentRequest(resolvedArgs);
        case 'check_payment_status': return await this.checkPaymentStatus(resolvedArgs);
        case 'submit_payment_proof': return await this.submitPaymentProof(resolvedArgs);
        case 'get_hotel_policies': return await this.getHotelPolicies(resolvedArgs);
        case 'get_reservation': return await this.getReservation();
        case 'start_pre_checkin': return await this.startPreCheckin();
        case 'handoff_to_human': return await this.handoffToHuman(resolvedArgs);
        default: return { error: `Tool ${name} no encontrada` };
      }
    } catch (error: any) {
      console.error(`[ToolExecutor] ${name} failed:`, error?.message);
      return { error: error?.message || 'No se pudo completar la operacion' };
    }
  }

  private async searchAvailability(args: any) {
    const { data, error } = await this.supabase.rpc('ai_search_availability_v2', {
      p_hotel_id: this.hotelId,
      p_fecha_entrada: args.check_in,
      p_fecha_salida: args.check_out,
      p_adultos: args.adults || 1,
      p_ninos: args.children || 0
    });
    if (error) throw error;
    await this.supabase.from('ai_conversations').update({
      journey_stage: 'availability_checked', updated_at: new Date().toISOString()
    }).eq('id', this.conversationId).eq('hotel_id', this.hotelId);
    return data;
  }

  private async createQuote(args: any) {
    const { data, error } = await this.supabase.rpc('ai_create_verified_quote', {
      p_hotel_id: this.hotelId,
      p_conversation_id: this.conversationId,
      p_habitacion_id: args.habitacion_id,
      p_fecha_entrada: args.check_in,
      p_fecha_salida: args.check_out,
      p_adultos: args.adults || 1,
      p_ninos: args.children || 0
    });
    if (error) throw error;
    return data;
  }

  private async createReservationHold(args: any) {
    const { data, error } = await this.supabase.rpc('ai_accept_quote_and_create_hold', {
      p_hotel_id: this.hotelId,
      p_conversation_id: this.conversationId,
      p_quote_id: args.quote_id,
      p_guest_name: args.guest_name,
      p_guest_phone: args.guest_phone,
      p_guest_document: args.guest_document,
      p_guest_email: args.guest_email || null,
      p_guest_document_type: args.guest_document_type || 'DNI'
    });
    if (error) throw error;
    return data;
  }

  private async createPaymentRequest(args: any) {
    const { data, error } = await this.supabase.rpc('ai_create_payment_request', {
      p_hotel_id: this.hotelId,
      p_conversation_id: this.conversationId,
      p_hold_id: args.hold_id,
      p_method: args.method
    });
    if (error) throw error;
    return data;
  }

  private async checkPaymentStatus(args: any) {
    const { data, error } = await this.supabase
      .from('ai_payment_intents')
      .select('id,status,amount,currency,method,expires_at,reservation_id')
      .eq('id', args.payment_intent_id)
      .eq('hotel_id', this.hotelId)
      .eq('conversation_id', this.conversationId)
      .single();
    if (error) throw error;
    return { success: true, payment: data };
  }

  private async submitPaymentProof(args: any) {
    const { data: payment, error: paymentError } = await this.supabase
      .from('ai_payment_intents')
      .update({
        status: 'awaiting_manual_review',
        provider_reference: args.reference || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', args.payment_intent_id)
      .eq('hotel_id', this.hotelId)
      .eq('conversation_id', this.conversationId)
      .eq('provider', 'manual')
      .eq('status', 'pending')
      .select('id,status,amount,currency,method')
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return { success: false, error: 'El pago manual no esta pendiente o no pertenece a esta conversacion' };
    await this.supabase.from('ai_conversations').update({
      status: 'handed_off', journey_stage: 'payment_under_review', human_controlled: true,
      updated_at: new Date().toISOString()
    }).eq('id', this.conversationId).eq('hotel_id', this.hotelId);
    return { success: true, payment, message: 'Evidencia registrada para revision de recepcion.' };
  }

  private async getHotelPolicies(args: any) {
    const topic = String(args.topic || '').trim().toLowerCase();
    const { data, error } = await this.supabase
      .from('ai_hotel_knowledge')
      .select('category,title,content')
      .eq('hotel_id', this.hotelId)
      .eq('activo', true)
      .in('category', ['politicas', 'servicios', 'faq', 'general'])
      .limit(20);
    if (error) throw error;
    const matches = (data || []).filter((item: any) => {
      const haystack = `${item.title} ${item.content}`.toLowerCase();
      return !topic || haystack.includes(topic) || item.category === 'politicas';
    }).slice(0, 8);
    return { success: true, policies: matches };
  }

  private async getReservation() {
    const { data: conversation, error: conversationError } = await this.supabase
      .from('ai_conversations')
      .select('reserva_id,journey_stage')
      .eq('id', this.conversationId)
      .eq('hotel_id', this.hotelId)
      .single();
    if (conversationError) throw conversationError;
    if (!conversation.reserva_id) return { success: false, error: 'No existe una reserva confirmada en esta conversacion' };

    const { data: reservation, error } = await this.supabase.from('reservas')
      .select('id,numero_reserva,estado,estado_pago,habitacion_numero,habitacion_tipo,fecha_entrada,fecha_salida,noches,total,huesped_nombre')
      .eq('id', conversation.reserva_id).eq('hotel_id', this.hotelId).single();
    if (error) throw error;
    return { success: true, reservation };
  }

  private async startPreCheckin() {
    const { data, error } = await this.supabase.rpc('ai_enqueue_precheckin_delivery', {
      p_hotel_id: this.hotelId,
      p_conversation_id: this.conversationId,
    });
    if (error) throw error;
    // The database creates short-lived credentials only at delivery time. The model
    // receives no raw guest token or URL that could be persisted in model history.
    return data;
  }

  private async handoffToHuman(args: any) {
    const { error } = await this.supabase.from('ai_conversations').update({
      status: 'handed_off', journey_stage: 'handed_off', human_controlled: true,
      metadata: { handoff_reason: args.reason }, updated_at: new Date().toISOString()
    }).eq('id', this.conversationId).eq('hotel_id', this.hotelId);
    if (error) throw error;
    return { success: true, message: 'Conversacion transferida a recepcion.' };
  }
}
