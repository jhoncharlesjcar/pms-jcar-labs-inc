/**
 * Fuente de verdad de los estados operativos de una habitación.
 *
 * El color nunca es la única señal: cada estado también expone una etiqueta
 * estable y las transiciones que el negocio permite ejecutar desde la UI.
 */

export type RoomStatus =
  | 'disponible'
  | 'ocupada'
  | 'reservada'
  | 'limpieza'
  | 'mantenimiento';

export const ROOM_STATUS_CONFIG: Record<RoomStatus, {
  label: string;
  shortLabel: string;
  badgeClass: string;
  solidClass: string;
}> = {
  disponible: {
    label: 'Disponible',
    shortLabel: 'Lista',
    badgeClass: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    solidClass: 'bg-emerald-500',
  },
  ocupada: {
    label: 'Ocupada',
    shortLabel: 'Ocupada',
    badgeClass: 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30',
    solidClass: 'bg-rose-500',
  },
  reservada: {
    label: 'Reservada',
    shortLabel: 'Reservada',
    badgeClass: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
    solidClass: 'bg-blue-500',
  },
  limpieza: {
    label: 'Pendiente de limpieza',
    shortLabel: 'Limpieza',
    badgeClass: 'bg-violet-500/15 text-violet-800 dark:text-violet-300 border-violet-500/30',
    solidClass: 'bg-violet-500',
  },
  mantenimiento: {
    label: 'Mantenimiento',
    shortLabel: 'Mantenimiento',
    badgeClass: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    solidClass: 'bg-amber-500',
  },
};

/**
 * Transiciones manuales permitidas. Las transiciones automáticas producidas
 * por reserva/check-in/check-out usan estas mismas reglas de dominio.
 */
export const ROOM_STATUS_TRANSITIONS: Record<RoomStatus, readonly RoomStatus[]> = {
  disponible: ['reservada', 'ocupada', 'mantenimiento'],
  reservada: ['ocupada', 'disponible'],
  ocupada: ['disponible', 'limpieza'],
  limpieza: ['disponible'],
  mantenimiento: ['disponible'],
};

export function isRoomStatus(value: string): value is RoomStatus {
  return Object.prototype.hasOwnProperty.call(ROOM_STATUS_CONFIG, value);
}

export function canTransitionRoomStatus(from: string, to: string): boolean {
  if (!isRoomStatus(from) || !isRoomStatus(to)) return false;
  return ROOM_STATUS_TRANSITIONS[from].includes(to);
}

/** Estado de habitación resultante de un cambio de reserva. */
export function roomStatusForReservationTransition(
  previousReservationStatus: string,
  nextReservationStatus: string,
): RoomStatus | null {
  if (nextReservationStatus === 'activa') return 'ocupada';
  if (nextReservationStatus === 'finalizada') return 'limpieza';
  if (nextReservationStatus === 'cancelada') {
    return previousReservationStatus === 'activa' ? 'limpieza' : 'disponible';
  }
  return null;
}
