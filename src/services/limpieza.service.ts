/**
 * limpieza.service.ts — Lógica pura del dominio Limpieza / Housekeeping
 *
 * Este servicio contiene funciones de transición de estados de limpieza,
 * control de insumos, alertas de stock bajo y asignación de tareas,
 * aisladas de efectos secundarios (DB, UI, API).
 *
 * @see specs/domain-limpieza.md
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoMovimientoInsumo = 'entrada' | 'salida';

export interface InsumoData {
  id: string;
  hotel_id: string;
  nombre: string;
  stock: number;
  unidad_medida: string;
  umbral_minimo: number;
  costo_unitario: number;
  activo: boolean;
}

export interface MovimientoInsumoData {
  insumo_id: string;
  tipo_movimiento: TipoMovimientoInsumo;
  cantidad: number;
  costo_total: number;
  motivo: string;
  usuario_id: string;
  limpieza_id?: string;
}

export interface LimpiezaPendiente {
  id: string;
  hotel_id: string;
  habitacion_id: string;
  usuario_id?: string;
  fecha_asignacion: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  observaciones?: string;
}

export interface HabitacionLimpieza {
  id: string;
  numero: string;
  estado: string;
  descripcion?: string;
}

export interface RegistrarConsumoParams {
  insumoId: string;
  cantidad: number;
  usuarioId: string;
  limpiezaId?: string;
  motivo?: string;
}

export interface AsignarTareaParams {
  habitacionId: string;
  hotelId: string;
  usuarioId?: string;
}

export interface LimpiezaHistorial {
  habitacionId: string;
  usuarioId: string;
  fechaInicio: string;
  fechaFin: string;
  duracionMinutos: number;
  insumosUsados: Array<{ insumoId: string; nombre: string; cantidad: number }>;
  observaciones?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Estados de limpieza */
export const ESTADOS_LIMPIEZA = {
  PENDING: 'limpieza',
  IN_PROGRESS: 'limpieza',
  COMPLETED: 'disponible',
} as const;

/** Tipos de movimiento de insumos */
export const TIPOS_MOVIMIENTO: TipoMovimientoInsumo[] = ['entrada', 'salida'];

/** Unidades de medida comunes */
export const UNIDADES_MEDIDA = ['pieza', 'unidad', 'litro', 'kilogramo', 'galon', 'paquete', 'caja'];

// ---------------------------------------------------------------------------
// RN-LIM-001: Transición a Limpieza post-check-out
// ---------------------------------------------------------------------------

/**
 * Prepara el cambio de estado de una habitación a 'limpieza' tras el check-out.
 *
 * Regla:
 *   SI check-out exitoso → habitacion.estado = 'limpieza'
 *   Se prepara el payload para registrar en limpieza_pendientes
 *
 * @param habitacion - Habitación que sale de check-out
 * @returns Payload para cambio de estado y registro de pendiente
 *
 * @see RN-LIM-001
 */
export function prepararTransicionALimpieza(habitacion: HabitacionLimpieza): {
  nuevoEstado: string;
  limpiezaPendiente: {
    habitacion_id: string;
    fecha_asignacion: string;
  };
} {
  return {
    nuevoEstado: ESTADOS_LIMPIEZA.PENDING,
    limpiezaPendiente: {
      habitacion_id: habitacion.id,
      fecha_asignacion: new Date().toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// RN-LIM-002/003: Completar Limpieza
// ---------------------------------------------------------------------------

/**
 * Valida que se pueda completar la limpieza de una habitación.
 *
 * Reglas:
 *   - La habitación debe estar en estado 'limpieza'
 *   - Opcionalmente se registran los insumos usados
 *   - La habitación cambia a 'disponible'
 *
 * @param habitacion - Habitación a completar
 * @param insumosUsados - Lista de insumos consumidos durante la limpieza
 * @returns Resultado con nuevo estado y movimientos de insumos a registrar
 *
 * @see RN-LIM-002
 * @see RN-LIM-003
 */
export function completarLimpieza(
  habitacion: HabitacionLimpieza,
  insumosUsados: Array<{ insumoId: string; cantidad: number; costoTotal: number }> = [],
  usuarioId: string = '',
  limpiezaPendienteId?: string
): {
  valido: boolean;
  error?: string;
  nuevoEstado: string;
  movimientos: Array<{
    insumo_id: string;
    tipo_movimiento: TipoMovimientoInsumo;
    cantidad: number;
    costo_total: number;
    motivo: string;
    usuario_id: string;
    limpieza_id?: string;
  }>;
} {
  if (habitacion.estado !== 'limpieza') {
    return {
      valido: false,
      error: `La habitación "${habitacion.numero}" no está en estado de limpieza (actual: ${habitacion.estado})`,
      nuevoEstado: habitacion.estado,
      movimientos: [],
    };
  }

  const movimientos = insumosUsados.map(ins => ({
    insumo_id: ins.insumoId,
    tipo_movimiento: 'salida' as TipoMovimientoInsumo,
    cantidad: ins.cantidad,
    costo_total: ins.costoTotal,
    motivo: `Consumo limpieza - Hab. ${habitacion.numero}`,
    usuario_id: usuarioId,
    limpieza_id: limpiezaPendienteId,
  }));

  return {
    valido: true,
    nuevoEstado: ESTADOS_LIMPIEZA.COMPLETED,
    movimientos,
  };
}

// ---------------------------------------------------------------------------
// RN-LIM-003: Consumo de Insumos
// ---------------------------------------------------------------------------

/**
 * Registra el consumo de un insumo y calcula el nuevo stock.
 *
 * @param insumo - Insumo actual
 * @param cantidad - Cantidad a consumir
 * @returns Resultado con nuevo stock y alerta si corresponde
 *
 * @see RN-LIM-003
 */
export function consumirInsumo(
  insumo: InsumoData,
  cantidad: number
): {
  valido: boolean;
  error?: string;
  nuevoStock: number;
  stockBajo: boolean;
  costoTotal: number;
} {
  if (!insumo.activo) {
    return { valido: false, error: `El insumo "${insumo.nombre}" está desactivado`, nuevoStock: insumo.stock, stockBajo: false, costoTotal: 0 };
  }

  if (cantidad <= 0) {
    return { valido: false, error: 'La cantidad a consumir debe ser mayor a 0', nuevoStock: insumo.stock, stockBajo: false, costoTotal: 0 };
  }

  if (cantidad > insumo.stock) {
    return { valido: false, error: `Stock insuficiente: ${insumo.stock} ${insumo.unidad_medida} disponible(s)`, nuevoStock: insumo.stock, stockBajo: false, costoTotal: 0 };
  }

  const nuevoStock = insumo.stock - cantidad;
  const stockBajo = nuevoStock <= insumo.umbral_minimo;
  const costoTotal = cantidad * insumo.costo_unitario;

  return { valido: true, nuevoStock, stockBajo, costoTotal };
}

// ---------------------------------------------------------------------------
// RN-LIM-004: Alerta de Stock Bajo
// ---------------------------------------------------------------------------

/**
 * Verifica si un insumo tiene stock bajo (≤ umbral mínimo).
 *
 * @param insumo - Insumo a verificar
 * @returns Resultado con indicación de alerta
 *
 * @see RN-LIM-004
 */
export function verificarStockBajo(insumo: Pick<InsumoData, 'stock' | 'umbral_minimo' | 'nombre'>): {
  stockBajo: boolean;
  mensaje?: string;
} {
  if (insumo.stock <= insumo.umbral_minimo) {
    return {
      stockBajo: true,
      mensaje: `Stock bajo: "${insumo.nombre}" (${insumo.stock} unidades, umbral: ${insumo.umbral_minimo})`,
    };
  }
  return { stockBajo: false };
}

// ---------------------------------------------------------------------------
// RN-LIM-005: Asignación de Tareas
// ---------------------------------------------------------------------------

/**
 * Prepara los datos para asignar una tarea de limpieza a un empleado.
 *
 * @param params - Parámetros de asignación
 * @returns Payload para crear la tarea asignada
 *
 * @see RN-LIM-005
 */
export function prepararAsignacionTarea(params: AsignarTareaParams): {
  hotel_id: string;
  habitacion_id: string;
  usuario_id?: string;
  fecha_asignacion: string;
} {
  return {
    hotel_id: params.hotelId,
    habitacion_id: params.habitacionId,
    usuario_id: params.usuarioId || undefined,
    fecha_asignacion: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// RN-LIM-006: Historial de Limpieza
// ---------------------------------------------------------------------------

/**
 * Calcula la duración de una limpieza en minutos.
 *
 * @param fechaInicio - Fecha ISO de inicio de limpieza
 * @param fechaFin - Fecha ISO de fin de limpieza
 * @returns Duración en minutos (mínimo 1)
 *
 * @see RN-LIM-006
 */
export function calcularDuracionLimpieza(fechaInicio: string, fechaFin: string): {
  duracionMinutos: number;
  valido: boolean;
  error?: string;
} {
  const inicio = new Date(fechaInicio);
  const fin = new Date(fechaFin);

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    return { duracionMinutos: 0, valido: false, error: 'Fechas inválidas' };
  }

  if (fin <= inicio) {
    return { duracionMinutos: 0, valido: false, error: 'La fecha de fin debe ser posterior a la de inicio' };
  }

  const diffMs = fin.getTime() - inicio.getTime();
  const duracionMinutos = Math.max(1, Math.round(diffMs / 60000));

  return { duracionMinutos, valido: true };
}

/**
 * Construye el payload del historial de limpieza para registro inmutable.
 *
 * @param data - Datos de la limpieza completada
 * @returns Payload para registrar en la tabla de historial
 *
 * @see RN-LIM-006
 */
export function construirHistorialLimpieza(data: LimpiezaHistorial): {
  habitacion_id: string;
  usuario_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_minutos: number;
  insumos_usados: Array<{ insumoId: string; nombre: string; cantidad: number }>;
  observaciones: string;
} {
  return {
    habitacion_id: data.habitacionId,
    usuario_id: data.usuarioId,
    fecha_inicio: data.fechaInicio,
    fecha_fin: data.fechaFin,
    duracion_minutos: data.duracionMinutos,
    insumos_usados: data.insumosUsados,
    observaciones: data.observaciones || '',
  };
}

// ---------------------------------------------------------------------------
// LN-LIM-009/010: Movimientos de Insumos (Entrada/Salida)
// ---------------------------------------------------------------------------

/**
 * Procesa un movimiento de entrada de insumo (incrementa stock).
 *
 * @param insumo - Insumo actual
 * @param cantidad - Cantidad a ingresar
 * @param costoTotal - Costo total de la compra
 * @returns Resultado con nuevo stock
 *
 * @see RN-LIM-009
 */
export function registrarEntradaInsumo(
  insumo: InsumoData,
  cantidad: number
): {
  valido: boolean;
  error?: string;
  nuevoStock: number;
} {
  if (!insumo.activo) {
    return { valido: false, error: `El insumo "${insumo.nombre}" está desactivado`, nuevoStock: insumo.stock };
  }

  if (cantidad <= 0) {
    return { valido: false, error: 'La cantidad debe ser mayor a 0', nuevoStock: insumo.stock };
  }

  const nuevoStock = insumo.stock + cantidad;

  return { valido: true, nuevoStock };
}

/**
 * Procesa un movimiento de salida de insumo (decrementa stock).
 *
 * @param insumo - Insumo actual
 * @param cantidad - Cantidad a retirar
 * @returns Resultado con nuevo stock y alerta de stock bajo
 *
 * @see RN-LIM-010
 */
export function registrarSalidaInsumo(
  insumo: InsumoData,
  cantidad: number
): {
  valido: boolean;
  error?: string;
  nuevoStock: number;
  stockBajo: boolean;
} {
  return consumirInsumo(insumo, cantidad);
}

/**
 * Obtiene la lista de insumos con stock bajo de un conjunto de insumos.
 *
 * @param insumos - Lista de insumos a evaluar
 * @returns Lista de insumos con stock bajo
 *
 * @see RN-LIM-004
 */
export function obtenerInsumosStockBajo(insumos: InsumoData[]): Array<{
  insumo: InsumoData;
  alerta: string;
}> {
  const resultados: Array<{ insumo: InsumoData; alerta: string }> = [];

  for (const insumo of insumos) {
    const verif = verificarStockBajo(insumo);
    if (verif.stockBajo && verif.mensaje) {
      resultados.push({ insumo, alerta: verif.mensaje });
    }
  }

  return resultados;
}
