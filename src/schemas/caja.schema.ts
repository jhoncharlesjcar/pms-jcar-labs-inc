/**
 * Schema de validación Zod para el dominio Caja / Egresos / Cierres.
 *
 * Valida formularios de:
 * - Registro de egresos (gastos operativos, compras de insumos)
 * - Cierre de caja (turno)
 *
 * @see specs/domain-checkout.md
 * @see src/pages/Caja.jsx
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Categorías válidas para egresos */
export const CATEGORIAS_EGRESO = [
  'operativo',
  'servicios',
  'insumos',
  'mantenimiento',
  'personal',
  'otros',
] as const;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Schema para registrar un egreso (gasto o compra).
 *
 * Reglas de negocio:
 * - Monto debe ser > 0
 * - Concepto debe tener al menos 3 caracteres
 * - Si categoría es 'insumos', debe especificar insumo_id y cantidad_insumo
 *
 * @see RN-CHECKOUT-004 (validación financiera)
 */
export const egresoSchema = z.object({
  monto: z
    .number({ invalid_type_error: 'El monto debe ser un número' })
    .positive('El monto debe ser mayor a 0'),
  concepto: z
    .string()
    .trim()
    .min(3, 'El concepto debe tener al menos 3 caracteres')
    .max(500, 'El concepto es demasiado largo'),
  categoria: z
    .enum(CATEGORIAS_EGRESO, {
      errorMap: () => ({ message: 'Selecciona una categoría válida' }),
    }),
  insumo_id: z
    .string()
    .optional()
    .default(''),
  cantidad_insumo: z
    .number({ invalid_type_error: 'La cantidad debe ser un número' })
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0')
    .optional(),
}).refine(data => {
  // Si la categoría es 'insumos', deben especificarse el insumo y la cantidad
  if (data.categoria === 'insumos') {
    return !!data.insumo_id && !!data.cantidad_insumo && data.cantidad_insumo > 0;
  }
  return true;
}, {
  message: 'Debe seleccionar el insumo y una cantidad válida',
  path: ['insumo_id'],
});

export type EgresoFormData = z.infer<typeof egresoSchema>;

/**
 * Schema para cerrar la caja del turno.
 *
 * El cierre registra el balance final y permite añadir notas opcionales
 * sobre novedades o diferencias encontradas durante el arqueo.
 */
export const cierreCajaSchema = z.object({
  notas: z
    .string()
    .trim()
    .max(1000, 'Las notas son demasiado largas')
    .optional()
    .default(''),
});

export type CierreCajaFormData = z.infer<typeof cierreCajaSchema>;
