export type TipoComprobante = 'boleta' | 'factura' | 'ninguno';

export type EstadoComprobante = 'ticket_interno' | 'sunat_pendiente' | 'sunat_emitido' | 'sunat_rechazado';

/** Tipos de comprobante SUNAT soportados */
export const TIPOS_COMPROBANTE: TipoComprobante[] = ['boleta', 'factura', 'ninguno'];

/** Estados del comprobante SUNAT (RN-VEN-003) */
export const ESTADOS_COMPROBANTE: EstadoComprobante[] = [
  'ticket_interno',
  'sunat_pendiente',
  'sunat_emitido',
  'sunat_rechazado',
];
