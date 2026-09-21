import { supabase } from '@/config/supabase';
import { Hotel } from '@/types';

/** Columnas operativas. No incluir bytea/secretos: PostgREST 500 y fuga de credenciales. */
const HOTEL_LIST_COLUMNS = [
  'id',
  'nombre',
  'activo',
  'ciudad',
  'ruc',
  'razon_social',
  'direccion',
  'telefono',
  'email',
  'aplica_igv',
  'modo_sunat',
  'logo_url',
  'hora_checkin',
  'hora_checkout',
  'loyalty_program_enabled',
  'moneda_base',
  'created_at',
].join(',');

export const HotelService = {
  /**
   * Lista todos los hoteles asociados al tenant actual
   */
  async listHoteles(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hoteles')
      .select(HOTEL_LIST_COLUMNS)
      .eq('activo', true)
      .order('nombre')
      .limit(100);

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
