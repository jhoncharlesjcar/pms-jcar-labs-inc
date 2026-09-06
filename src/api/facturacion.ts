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

export interface NotaComprobanteParams {
  comprobante_ref_id: number;
  tipo: 'nota_credito' | 'nota_debito';
  /** Catálogo 09: 01=Anulación, 04=Descuento global, etc. */
  tipo_nota: string;
  motivo?: string;
  subtotal: number;
  igv: number;
  total: number;
}

/**
 * Emite una Nota de Crédito (07) o Nota de Débito (08) referenciando un
 * comprobante (Factura/Boleta) previamente aceptado por SUNAT.
 */
export async function crearNotaComprobante(params: NotaComprobanteParams) {
  if (!params.comprobante_ref_id || !params.tipo_nota) {
    throw new Error('La nota requiere el comprobante de referencia y el tipo de nota');
  }
  const { data, error } = await supabase.functions.invoke('facturacion', {
    body: params,
  });
  if (error) throw new Error(error.message || 'El servicio de facturación no está disponible');
  if (!data || data.error) throw new Error(data?.error || 'SUNAT no confirmó la emisión de la nota');
  return data;
}
