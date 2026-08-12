/**
 * Fuente de verdad centralizada para los colores de estado de habitaciones.
 * Usada en HabitacionesGrid, Dashboard, Layout y cualquier componente que muestre
 * badges, tarjetas o indicadores de estado.
 *
 * Estados definidos por el negocio:
 *   disponible → Verde  (emerald)
 *   ocupada    → Rojo   (red)
 *   reservada  → Azul   (blue)
 *   mantenimiento → Amarillo (amber)
 *   limpieza   → Púrpura  (purple)
 */

export type RoomStatus =
  | 'disponible'
  | 'ocupada'
  | 'reservada'
  | 'mantenimiento'
  | 'limpieza';

export interface StatusColorSet {
  /** Sombra interna de la tarjeta (glow de color) */
  card: string;
  /** Badge de texto con fondo semitransparente */
  badge: string;
  /** Número/texto con glow neón */
  number: string;
  /** Color sólido para barras de progreso y puntos de estado */
  solid: string;
  /** Clase de ícono (color + glow) */
  icon: string;
}

export const statusColors: Record<RoomStatus, StatusColorSet> = {
  disponible: {
    card:   'bg-green-500/5 shadow-[inset_0_0_30px_rgba(34,197,94,0.15)]',
    badge:  'bg-green-500/10 text-green-400 border-green-500/20',
    number: 'text-green-400 drop-shadow-[0_0_10px_currentColor] brightness-110',
    solid:  'bg-emerald-500',
    icon:   'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
  },
  ocupada: {
    card:   'bg-red-500/5 shadow-[inset_0_0_30px_rgba(239,68,68,0.15)]',
    badge:  'bg-red-500/10 text-red-400 border-red-500/20',
    number: 'text-red-400 drop-shadow-[0_0_10px_currentColor] brightness-110',
    solid:  'bg-red-500',
    icon:   'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.8)]',
  },
  reservada: {
    card:   'bg-blue-500/5 shadow-[inset_0_0_30px_rgba(59,130,246,0.15)]',
    badge:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    number: 'text-blue-400 drop-shadow-[0_0_10px_currentColor] brightness-110',
    solid:  'bg-blue-500',
    icon:   'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]',
  },
  mantenimiento: {
    card:   'bg-amber-500/5 shadow-[inset_0_0_30px_rgba(245,158,11,0.15)]',
    badge:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    number: 'text-amber-400 drop-shadow-[0_0_10px_currentColor] brightness-110',
    solid:  'bg-amber-500',
    icon:   'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]',
  },
  limpieza: {
    card:   'bg-purple-500/5 shadow-[inset_0_0_30px_rgba(168,85,247,0.15)]',
    badge:  'bg-purple-500/10 text-purple-400 border-purple-500/20',
    number: 'text-purple-400 drop-shadow-[0_0_10px_currentColor] brightness-110',
    solid:  'bg-purple-500',
    icon:   'text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.8)]',
  },
};

/** Helper: devuelve el set de colores para un estado dado (con fallback a disponible). */
export function getStatusColors(estado: string): StatusColorSet {
  return statusColors[estado as RoomStatus] ?? statusColors.disponible;
}
