export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'tarjeta';

/** Métodos de pago soportados por el sistema (RN-VEN-001) */
export const METODOS_PAGO: MetodoPago[] = [
  'efectivo',
  'yape',
  'plin',
  'transferencia',
  'tarjeta',
];

/** Métodos de pago digital que requieren código de operación */
export const METODOS_CON_REFERENCIA: MetodoPago[] = ['yape', 'plin'];
