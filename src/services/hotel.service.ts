import { supabase } from '@/config/supabase';
import { Hotel } from '@/types';

export const HotelService = {
  /**
   * Lista todos los hoteles asociados al tenant actual
   */
  async listHoteles(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hoteles')
      .select('*')
      .order('nombre');

    if (error) throw error;
    return data || [];
  },

  /**
   * Obtiene la configuración específica de un hotel por su ID
   */
  async getHotelById(hotelId: string): Promise<Hotel> {
    const { data, error } = await supabase
      .from('hoteles')
      .select('*')
      .eq('id', hotelId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualiza los datos o configuraciones operativas del hotel (IGV, Check-Out, Razón Social)
   */
  async updateConfiguracion(hotelId: string, updates: Partial<Hotel>): Promise<Hotel> {
    const { data, error } = await supabase
      .from('hoteles')
      .update(updates)
      .eq('id', hotelId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
