/**
 * Schema de validación Zod para el dominio Limpieza / Housekeeping.
 *
 * Valida formularios de:
 * - Creación/edición de insumos
 * - Registro de movimientos de insumos (entrada/salida)
 * - Completar tareas de limpieza con consumo de insumos
 * - Asignación de tareas de limpieza
 *
 * @see specs/domain-limpieza.md
 * @see src/services/limpieza.service.ts
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constantes compartidas
// ---------------------------------------------------------------------------

/** Tipos válidos de movimiento de insumos */
export const TIPOS_MOVIMIENTO = ['entrada', 'salida'] as const;

/** Unidades de medida comunes para insumos */
export const UNIDADES_MEDIDA = [
  'pieza',
  'unidad',
  'litro',
  'kilogramo',
  'galon',
  'paquete',
  'caja',
] as const;

/** Estados del flujo de limpieza (alineado con limpieza.service.ts) */
export const ESTADOS_LIMPIEZA = ['limpieza', 'disponible'] as const;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema para crear o editar un insumo de limpieza.
 *
 * @see RN-LIM-003 — Control de insumos
 * @see Tabla `insumos` en spec
 */
export const insumoSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'El nombre del insumo debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),
  stock: z
    .number({ invalid_type_error: 'El stock debe ser un número' })
    .int('El stock debe ser un número entero')
    .min(0, 'El stock no puede ser negativo')
    .default(0),
  unidad_medida: z
    .enum(UNIDADES_MEDIDA, {
      errorMap: () => ({ message: 'Selecciona una unidad de medida válida' }),
    })
    .default('unidad'),
  umbral_minimo: z
    .number({ invalid_type_error: 'El umbral debe ser un número' })
    .int('El umbral debe ser un número entero')
    .min(1, 'El umbral mínimo debe ser al menos 1')
    .default(10),
  costo_unitario: z
    .number({ invalid_type_error: 'El costo unitario debe ser un número' })
    .min(0, 'El costo unitario no puede ser negativo')
    .default(0),
  activo: z.boolean().default(true),
});

export type InsumoFormData = z.infer<typeof insumoSchema>;

/**
 * Schema para registrar un movimiento de entrada o salida de insumo.
 *
 * - 'entrada': Se incrementa el stock (compra/reposición)
 * - 'salida': Se decrementa el stock (consumo en limpieza)
 *
 * @see RN-LIM-009/010 — Movimientos de insumos
 * @see Tabla `movimientos_insumos` en spec
 */
export const movimientoInsumoSchema = z.object({
  insumo_id: z
    .string()
    .min(1, 'Debes seleccionar un insumo'),
  tipo_movimiento: z
    .enum(TIPOS_MOVIMIENTO, {
      errorMap: () => ({ message: 'Tipo de movimiento inválido' }),
    }),
  cantidad: z
    .number({ invalid_type_error: 'La cantidad debe ser un número' })
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0'),
  costo_total: z
    .number({ invalid_type_error: 'El costo total debe ser un número' })
    .min(0, 'El costo total no puede ser negativo')
    .default(0),
  motivo: z
    .string()
    .trim()
    .min(3, 'El motivo debe tener al menos 3 caracteres')
    .max(500, 'El motivo es demasiado largo'),
  limpieza_id: z.string().optional(),
});

export type MovimientoInsumoFormData = z.infer<typeof movimientoInsumoSchema>;

/**
 * Schema para completar una tarea de limpieza con registro de insumos usados.
 *
 * - La habitación debe estar en estado 'limpieza'
 * - Opcionalmente se registran los insumos consumidos
 * - Se puede incluir el ID del usuario que realizó la limpieza
 *
 * @see RN-LIM-002 — Completar limpieza
 * @see RN-LIM-003 — Consumo de insumos
 */
export const completarLimpiezaSchema = z.object({
  habitacion_id: z
    .string()
    .min(1, 'Debes seleccionar una habitación'),
  observaciones: z
    .string()
    .trim()
    .max(500, 'Las observaciones son demasiado largas')
    .optional()
    .default(''),
  insumos_usados: z
    .array(
      z.object({
        insumo_id: z.string().min(1, 'Debes seleccionar un insumo'),
        cantidad: z
          .number()
          .int()
          .positive('La cantidad debe ser mayor a 0'),
        costo_total: z
          .number()
          .min(0, 'El costo total no puede ser negativo')
          .default(0),
      })
    )
    .default([]),
});

export type CompletarLimpiezaFormData = z.infer<typeof completarLimpiezaSchema>;

/**
 * Schema para asignar una tarea de limpieza a un empleado.
 *
 * La asignación es opcional: si no se asigna usuario, cualquiera del equipo
 * puede tomar la tarea.
 *
 * @see RN-LIM-005 — Asignación de tareas
 */
export const asignarLimpiezaSchema = z.object({
  habitacion_id: z
    .string()
    .min(1, 'Debes seleccionar una habitación'),
  usuario_id: z
    .string()
    .optional(),
  observaciones: z
    .string()
    .trim()
    .max(500, 'Las observaciones son demasiado largas')
    .optional()
    .default(''),
});

export type AsignarLimpiezaFormData = z.infer<typeof asignarLimpiezaSchema>;


