export type AvailabilityView = 'loading' | 'error' | 'empty' | 'rooms';

export const AVAILABILITY_COPY = {
  loading: 'Consultando disponibilidad y tarifas del PMS…',
  error: 'No se pudo consultar disponibilidad. Recarga e inténtalo de nuevo.',
  empty: 'Ninguna libre en este rango. Cambia las fechas de arriba.',
} as const;

/** RPC failure is never shown as "no rooms". */
export function receptionAvailabilityView(
  loading: boolean,
  error: unknown,
  roomCount: number,
): AvailabilityView {
  if (loading) return 'loading';
  if (error) return 'error';
  if (roomCount <= 0) return 'empty';
  return 'rooms';
}
