import { supabase } from '@/config/supabase';

export type FacturacionSource = 'ventas' | 'ventas_pos';

/**
 * Solicita emisión usando únicamente la venta persistida. La Edge Function
 * reconstruye tenant, receptor, líneas, impuestos y correlativo desde BD.
 */
export async function crearComprobante(ventaId: string, source: FacturacionSource) {
  if (!ventaId) throw new Error('No se puede emitir un comprobante sin una venta persistida');
  const { data, error } = await supabase.functions.invoke('facturacion', {
    body: { venta_id: ventaId, source },
  });
  if (error) throw new Error(error.message || 'El servicio de facturación no está disponible');
  if (!data || data.error) throw new Error(data?.error || 'SUNAT no confirmó la emisión');
  return data;
}
