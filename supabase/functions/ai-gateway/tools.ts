// @ts-nocheck: bypassing strict type checks for AI dynamic args

export const geminiToolsDefinition = [
  {
    functionDeclarations: [
      {
        name: "check_availability",
        description: "Consulta disponibilidad de habitaciones y precios en el PMS. Úsalo siempre que un huésped pregunte por fechas.",
        parameters: {
          type: "object",
          properties: {
            check_in: { type: "string", description: "Fecha de entrada YYYY-MM-DD" },
            check_out: { type: "string", description: "Fecha de salida YYYY-MM-DD" },
            adults: { type: "integer", description: "Número de adultos. Por defecto 2." },
            children: { type: "integer", description: "Número de niños. Por defecto 0." }
          },
          required: ["check_in", "check_out"]
        }
      },
      {
        name: "calculate_quote",
        description: "Calcula y guarda una cotización exacta para la reserva.",
        parameters: {
          type: "object",
          properties: {
            habitacion_id: { type: "string", description: "ID UUID de la habitación seleccionada obtenido previamente con check_availability" },
            room_type: { type: "string", description: "Tipo de habitación seleccionada" },
            check_in: { type: "string", description: "Fecha de entrada YYYY-MM-DD" },
            check_out: { type: "string", description: "Fecha de salida YYYY-MM-DD" },
            adults: { type: "integer" },
            children: { type: "integer" },
            precio_noche: { type: "number", description: "Precio por noche retornado en check_availability" },
            total: { type: "number", description: "Total calculado retornado en check_availability" }
          },
          required: ["habitacion_id", "room_type", "check_in", "check_out", "precio_noche", "total"]
        }
      },
      {
        name: "create_reservation",
        description: "Crea la reserva oficial en el PMS. Requiere los datos del huésped y que la cotización haya sido aceptada.",
        parameters: {
          type: "object",
          properties: {
            guest_name: { type: "string", description: "Nombre completo del huésped" },
            guest_phone: { type: "string", description: "Teléfono del huésped, si lo proporcionó", nullable: true },
            guest_email: { type: "string", description: "Email del huésped", nullable: true },
            habitacion_id: { type: "string" },
            check_in: { type: "string", description: "YYYY-MM-DD" },
            check_out: { type: "string", description: "YYYY-MM-DD" },
            adults: { type: "integer" },
            children: { type: "integer" },
            precio_noche: { type: "number" },
            total: { type: "number" }
          },
          required: ["guest_name", "habitacion_id", "check_in", "check_out", "precio_noche", "total"]
        }
      },
      {
        name: "handoff_to_human",
        description: "Transfiere la conversación a un operador humano. Usa esto cuando no puedas resolver una solicitud, el cliente esté molesto o te pida hablar con alguien.",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Motivo por el que se transfiere a un humano" }
          },
          required: ["reason"]
        }
      }
    ]
  }
];

export class ToolExecutor {
  constructor(
    private supabase: any, 
    private hotelId: string, 
    private conversationId: string
  ) {}

  async executeTool(name: string, args: any): Promise<any> {
    console.log(`[ToolExecutor] Executing ${name} with args:`, args);
    try {
      switch (name) {
        case 'check_availability':
          return await this.checkAvailability(args);
        case 'calculate_quote':
          return await this.calculateQuote(args);
        case 'create_reservation':
          return await this.createReservation(args);
        case 'handoff_to_human':
          return await this.handoffToHuman(args);
        default:
          return { error: `Tool ${name} no encontrada` };
      }
    } catch (e: any) {
      console.error(`[ToolExecutor] Error en ${name}:`, e);
      return { error: e.message || 'Error interno al ejecutar la herramienta' };
    }
  }

  private async checkAvailability(args: any) {
    const { data, error } = await this.supabase.rpc('ai_check_availability', {
      p_hotel_id: this.hotelId,
      p_fecha_entrada: args.check_in,
      p_fecha_salida: args.check_out,
      p_adultos: args.adults || 2,
      p_ninos: args.children || 0
    });
    
    if (error) throw error;
    return data;
  }

  private async calculateQuote(args: any) {
    const noches = Math.max(1, Math.round((new Date(args.check_out).getTime() - new Date(args.check_in).getTime()) / (1000 * 60 * 60 * 24)));
    
    const { data, error } = await this.supabase
      .from('ai_quotes')
      .insert({
        hotel_id: this.hotelId,
        conversation_id: this.conversationId,
        room_type: args.room_type,
        habitacion_id: args.habitacion_id,
        fecha_entrada: args.check_in,
        fecha_salida: args.check_out,
        noches,
        adultos: args.adults || 2,
        ninos: args.children || 0,
        precio_noche: args.precio_noche,
        total: args.total,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    
    await this.supabase.from('ai_conversations')
      .update({ status: 'quoted' })
      .eq('id', this.conversationId);

    return { success: true, quote: data, message: 'Cotización guardada exitosamente' };
  }

  private async createReservation(args: any) {
    const { data, error } = await this.supabase.rpc('ai_create_guest_and_reservation', {
      p_hotel_id: this.hotelId,
      p_conversation_id: this.conversationId,
      p_guest_name: args.guest_name,
      p_guest_phone: args.guest_phone || '',
      p_guest_email: args.guest_email || '',
      p_habitacion_id: args.habitacion_id,
      p_fecha_entrada: args.check_in,
      p_fecha_salida: args.check_out,
      p_precio_noche: args.precio_noche,
      p_total: args.total,
      p_adultos: args.adults || 2,
      p_ninos: args.children || 0
    });

    if (error) throw error;
    return data;
  }

  private async handoffToHuman(args: any) {
    const { error } = await this.supabase
      .from('ai_conversations')
      .update({ status: 'handed_off', metadata: { handoff_reason: args.reason } })
      .eq('id', this.conversationId);

    if (error) throw error;
    return { success: true, message: 'Conversación transferida a operador humano.' };
  }
}
