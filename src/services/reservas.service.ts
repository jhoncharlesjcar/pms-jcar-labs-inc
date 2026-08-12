import { supabase } from '@/config/supabase';
import { Reserva } from '@/types';

export const ReservasService = {
  /**
   * Obtiene la lista de reservas asociadas a un hotel
   */
  async getReservasByHotel(hotelId: string): Promise<Reserva[]> {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('fecha_entrada', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Obtiene una reserva detallada por ID
   */
  async getReservaById(reservaId: string): Promise<Reserva> {
    const { data, error } = await supabase
      .from('reservas')
      .select('*')
      .eq('id', reservaId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Dispara la sincronización con OTAs (Booking, Despegar)
   */
  async triggerOtaSync(hotelId: string) {
    try {
      // Invocamos la Edge Function de manera asíncrona (fire and forget) para no bloquear la UI
      supabase.functions.invoke('ota-sync-inventory', {
        body: { hotel_id: hotelId, timestamp: new Date().toISOString() }
      }).catch(err => console.warn('Error silenciado en ota-sync-inventory:', err));
    } catch (error) {
      console.warn('Error al invocar ota-sync-inventory:', error);
    }
  },

  /**
   * Registra una nueva reserva
   */
  async crearReserva(reserva: Omit<Reserva, 'id'>): Promise<Reserva> {
    const { data, error } = await supabase
      .from('reservas')
      .insert(reserva)
      .select()
      .single();

    if (error) throw error;
    if (reserva.hotel_id) this.triggerOtaSync(reserva.hotel_id);
    return data;
  },

  /**
   * Actualiza el estado de una reserva (e.g. checkin, checkout, cancelada)
   */
  async actualizarEstado(
    reservaId: string, 
    nuevoEstado: Reserva['estado']
  ): Promise<Reserva> {
    const { data, error } = await supabase
      .from('reservas')
      .update({ estado: nuevoEstado })
      .eq('id', reservaId)
      .select()
      .single();

    if (error) throw error;
    if (data?.hotel_id) this.triggerOtaSync(data.hotel_id);
    return data;
  },

  /**
   * Actualiza los datos generales de una reserva
   */
  async actualizarReserva(
    reservaId: string, 
    updates: Partial<Omit<Reserva, 'id' | 'hotel_id'>>
  ): Promise<Reserva> {
    const { data, error } = await supabase
      .from('reservas')
      .update(updates)
      .eq('id', reservaId)
      .select()
      .single();

    if (error) throw error;
    if (data?.hotel_id) this.triggerOtaSync(data.hotel_id);
    return data;
  }
};
