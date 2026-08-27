/**
 * habitaciones.service.ts — Lógica pura del dominio Habitaciones
 *
 * Este servicio contiene funciones de validación, CRUD y transición
 * de estados del módulo de habitaciones, aisladas de efectos secundarios.
 *
 * @see specs/domain-habitaciones.md
 */

// ---------------------------------------------------------------------------
// Imports de otros servicios (reutilización)
// ---------------------------------------------------------------------------

import {
  ESTADOS_HABITACION,
  TRANSICIONES_HABITACION,
  esTransicionHabitacionValida,
  calcularTransicionHabitacion,
  type EstadoHabitacion,
  type TransicionResult,
} from '@/services/recepcion.service';

// Re-exportar para conveniencia
export { ESTADOS_HABITACION, TRANSICIONES_HABITACION, esTransicionHabitacionValida };

import { supabase } from '@/config/supabase';

export const HabitacionesService = {
  async getHabitacionesByHotel(hotelId: string): Promise<HabitacionData[]> {
    const { data, error } = await supabase
      .from('habitaciones')
      .select('id, hotel_id, numero, piso, tipo, estado, precio_noche, precio, capacidad, descripcion, amenities, imagen_url')
      .eq('hotel_id', hotelId)
      .order('numero', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async actualizarEstado(habitacionId: string, nuevoEstado: string): Promise<HabitacionData> {
    const { data, error } = await supabase
      .from('habitaciones')
      .update({ estado: nuevoEstado })
      .eq('id', habitacionId)
      .select('id, hotel_id, numero, piso, tipo, estado, precio_noche, precio, capacidad, descripcion, amenities, imagen_url')
      .single();

    if (error) throw error;
    return data;
  }
};

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoHabitacion =
  | 'simple'
  | 'doble simple'
  | 'matrimonial'
  | 'doble matrimonial'
  | 'mixta'
  | 'queen';

export interface HabitacionData {
  id?: string;
  hotel_id: string;
  numero: string;
  piso?: string;
  tipo: TipoHabitacion;
  estado: EstadoHabitacion;
  precio_noche: number;
  precio?: number;
  capacidad: number;
  descripcion?: string;
  amenities?: string[];
  imagen_url?: string | null;
}

export interface ValidarHabitacionParams {
  numero: string;
  precio_noche: number;
  capacidad: number;
  tipo: TipoHabitacion;
}

export interface ValidarHabitacionResult {
  valido: boolean;
  errors: string[];
}

export interface HabitacionResumen {
  id: string;
  numero: string;
  piso?: string;
  tipo: string;
  estado: string;
  precio_noche: number;
  capacidad: number;
  imagen_url?: string | null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Tipos de habitación válidos */
export const TIPOS_HABITACION: TipoHabitacion[] = [
  'simple', 'doble simple', 'matrimonial', 'doble matrimonial', 'mixta', 'queen',
];



// ---------------------------------------------------------------------------
// RN-HAB-002: Validación de Habitación
// ---------------------------------------------------------------------------

/**
 * Valida los datos de una habitación antes de crear o editar.
 *
 * @param params - Datos de la habitación a validar
 * @returns Resultado con lista de errores
 *
 * @see RN-HAB-002
 */
export function validarHabitacion(params: ValidarHabitacionParams): ValidarHabitacionResult {
  const errors: string[] = [];

  // Número obligatorio
  if (!params.numero || params.numero.trim() === '') {
    errors.push('El número de habitación es obligatorio');
  }

  // Precio no negativo
  if (params.precio_noche < 0) {
    errors.push('El precio por noche no puede ser negativo');
  }

  // Capacidad mínima 1
  if (params.capacidad < 1) {
    errors.push('La capacidad debe ser al menos 1 persona');
  }

  // Tipo válido
  if (!TIPOS_HABITACION.includes(params.tipo)) {
    errors.push(`Tipo de habitación "${params.tipo}" no es válido`);
  }

  return {
    valido: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// RN-HAB-002: Formateo de Habitación
// ---------------------------------------------------------------------------

/**
 * Formatea los datos de una habitación para insertar en BD.
 *
 * @param data - Datos crudos del formulario
 * @returns Payload limpio para Supabase
 *
 * @see RN-HAB-002
 */
export function formatearHabitacionParaBD(data: HabitacionData) {
  return {
    hotel_id: data.hotel_id,
    numero: data.numero.trim(),
    piso: data.piso?.trim() || null,
    tipo: data.tipo,
    estado: data.estado || 'disponible',
    precio_noche: Number(data.precio_noche) || 0,
    precio: Number(data.precio ?? data.precio_noche) || 0,
    capacidad: Number(data.capacidad) || 1,
    descripcion: data.descripcion?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// RN-HAB-005: Eliminación con Protección
// ---------------------------------------------------------------------------

/**
 * Verifica si una habitación puede ser eliminada.
 *
 * Regla: No se puede eliminar si tiene reservas activas.
 *
 * @param reservasActivas - Cantidad de reservas activas vinculadas
 * @returns Resultado con indicación si se puede eliminar
 *
 * @see RN-HAB-005
 */
export function puedeEliminarHabitacion(
  reservasActivas: number
): { permite: boolean; error?: string } {
  if (reservasActivas > 0) {
    return {
      permite: false,
      error: `No se puede eliminar: tiene ${reservasActivas} reserva(s) activa(s)`,
    };
  }
  return { permite: true };
}

// ---------------------------------------------------------------------------
// RN-HAB-001: Transición de Estado
// ---------------------------------------------------------------------------

/**
 * Calcula el nuevo estado de una habitación y valida la transición.
 *
 * Reutiliza `calcularTransicionHabitacion` de recepcion.service.ts
 * y valida contra `TRANSICIONES_HABITACION`.
 *
 * @param estadoActual - Estado actual de la habitación
 * @param accion - Acción a realizar
 * @param conLimpieza - Si el check-out incluye limpieza
 * @returns Resultado con nuevo estado y si es válido
 *
 * @see RN-HAB-001
 */
export function cambiarEstadoHabitacion(
  estadoActual: EstadoHabitacion,
  accion: 'check-in' | 'check-out' | 'cancelar' | 'mantenimiento' | 'limpieza',
  conLimpieza: boolean = false
): TransicionResult {
  const resultado = calcularTransicionHabitacion({ accion, conLimpieza });

  if (!resultado.valido) {
    return resultado;
  }

  const esValida = esTransicionHabitacionValida(estadoActual, resultado.nuevoEstado as EstadoHabitacion);

  if (!esValida) {
    return {
      nuevoEstado: estadoActual,
      valido: false,
      error: `No se puede cambiar de "${estadoActual}" a "${resultado.nuevoEstado}"`,
    };
  }

  return resultado;
}

// ---------------------------------------------------------------------------
// RN-HAB-004: Grid de Visualización
// ---------------------------------------------------------------------------

/**
 * Agrupa habitaciones por piso para el grid visual.
 *
 * @param habitaciones - Lista de habitaciones del hotel
 * @returns Mapa de piso → habitaciones ordenadas por número
 *
 * @see RN-HAB-004
 */
export function agruparPorPiso(habitaciones: HabitacionResumen[]): Map<string, HabitacionResumen[]> {
  const mapa = new Map();

  for (const hab of habitaciones) {
    const piso = hab.piso || 'Sin piso';
    const grupo = mapa.get(piso) || [];
    grupo.push(hab);
    mapa.set(piso, grupo);
  }

  // Ordenar habitaciones dentro de cada piso por número
  for (const [, grupo] of mapa) {
    grupo.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  }

  return mapa;
}

/**
 * Filtra habitaciones por estado.
 *
 * @param habitaciones - Lista de habitaciones
 * @param estado - Estado por el cual filtrar (null = todos)
 * @returns Lista filtrada
 *
 * @see RN-HAB-004
 */
export function filtrarPorEstado(
  habitaciones: HabitacionResumen[],
  estado: EstadoHabitacion | null
): HabitacionResumen[] {
  if (!estado) return habitaciones;
  return habitaciones.filter(h => h.estado === estado);
}

// ---------------------------------------------------------------------------
// RN-HAB-003: Estadísticas del Grid
// ---------------------------------------------------------------------------

/**
 * Calcula estadísticas de ocupación del hotel.
 *
 * @param habitaciones - Lista de habitaciones
 * @returns Estadísticas de ocupación
 *
 * @see Dashboard
 */
export function calcularEstadisticas(habitaciones: HabitacionResumen[]): {
  total: number;
  ocupadas: number;
  limpieza: number;
  disponibles: number;
  mantenimiento: number;
  reservadas: number;
  porcentajeOcupacion: number;
} {
  const total = habitaciones.length;
  const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
  const limpieza = habitaciones.filter(h => h.estado === 'limpieza').length;
  const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
  const mantenimiento = habitaciones.filter(h => h.estado === 'mantenimiento').length;
  const reservadas = habitaciones.filter(h => h.estado === 'reservada').length;
  const porcentajeOcupacion = total > 0
    ? Math.round(((ocupadas + limpieza) / total) * 100)
    : 0;

  return {
    total,
    ocupadas,
    limpieza,
    disponibles,
    mantenimiento,
    reservadas,
    porcentajeOcupacion,
  };
}
