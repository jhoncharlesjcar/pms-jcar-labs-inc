/**
 * checkout.service.ts — Lógica pura del dominio Check-out / Liquidación
 *
 * Este servicio contiene TODAS las funciones de cálculo y validación
 * del flujo de checkout, aisladas de efectos secundarios (DB, UI, API).
 *
 * @see specs/domain-checkout.md
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CalcularTotalParams {
  precio_noche: number;
  noches: number;
  total_consumos?: number;
  descuento?: number;
}

export interface CalcularTotalResult {
  total_estadia: number;
  total_consumos: number;
  total_bruto: number;
  descuento: number;
  total_final: number;
}

export interface CalcularIGVResult {
  base_imponible: number;
  igv: number;
  total_final: number;
}

export interface ReservaCheckout {
  id: string;
  huesped_nombre?: string;
  habitacion_id?: string;
  estado: string;
}

export interface HabitacionCheckout {
  id: string;
  numero?: string;
  estado: string;
}

export interface ProcesarCheckoutParams {
  reserva: ReservaCheckout;
  habitacion: HabitacionCheckout;
  pagoExitoso: boolean;
}

export interface ProcesarCheckoutResult {
  success: boolean;
  reserva: ReservaCheckout;
  habitacion: HabitacionCheckout;
  errors: string[];
}

export type { MetodoPago } from '@/constants/paymentMethods';
export type { TipoComprobante } from '@/constants/comprobantes';

export interface ValidarComprobanteParams {
  tipo: TipoComprobante;
  ruc?: string;
  razonSocial?: string;
  dni?: string;
  nombre?: string;
}

export interface ValidarComprobanteResult {
  valido: boolean;
  errors: string[];
}

export interface ValidarReferenciaParams {
  metodo: string;
  codigoReferencia: string;
}

export interface ValidarReferenciaResult {
  valido: boolean;
  error: string | null;
}

export interface PagoExistente {
  reserva_id: string;
  total?: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Tasa fija de IGV en Perú (18%) */
export const TASA_IGV = 0.18;

export { METODOS_PAGO as METODOS_PAGO_VALIDOS, METODOS_CON_REFERENCIA } from '@/constants/paymentMethods';

// ---------------------------------------------------------------------------
// CHECKOUT-001: Cálculo del Total a Cobrar
// ---------------------------------------------------------------------------

/**
 * Calcula el desglose completo del total a cobrar.
 *
 * Fórmula:
 *   total_estadia  = precio_noche × noches
 *   total_bruto    = total_estadia + total_consumos
 *   total_final    = max(0, total_bruto - descuento)
 *
 * @param params - Parámetros del cálculo
 * @returns Desglose completo con total_final nunca negativo
 *
 * @see RN-CHECKOUT-001
 */
export function calcularTotal(params: CalcularTotalParams): CalcularTotalResult {
  const { precio_noche, noches, total_consumos = 0, descuento = 0 } = params;
  const total_estadia = precio_noche * noches;
  const total_bruto = total_estadia + total_consumos;
  const total_final = Math.max(0, total_bruto - Math.max(0, descuento));

  return {
    total_estadia,
    total_consumos,
    total_bruto,
    descuento: Math.max(0, descuento),
    total_final,
  };
}

// ---------------------------------------------------------------------------
// CHECKOUT-002: IGV Condicional
// ---------------------------------------------------------------------------

/**
 * Calcula el IGV según la configuración del hotel.
 *
 * Regla:
 *   SI aplicaIGV = true  → base = total / 1.18, igv = total - base
 *   SI aplicaIGV = false → base = total, igv = 0
 *
 * @param total         - Monto total (con IGV incluido si aplica)
 * @param aplicaIGV     - true si el hotel aplica IGV
 * @returns Objeto con base_imponible, igv y total_final
 *
 * @see RN-CHECKOUT-002
 */
export function calcularIGV(total: number, aplicaIGV: boolean): CalcularIGVResult {
  if (!aplicaIGV) {
    return {
      base_imponible: total,
      igv: 0,
      total_final: total,
    };
  }

  const base = total / (1 + TASA_IGV);
  const igv = total - base;

  return {
    base_imponible: Math.round(base * 100) / 100,
    igv: Math.round(igv * 100) / 100,
    total_final: total,
  };
}

// ---------------------------------------------------------------------------
// CHECKOUT-003: Liberación de Habitación
// ---------------------------------------------------------------------------

/**
 * Procesa la liberación de la habitación y finalización de la reserva.
 *
 * Solo modifica estados si el pago fue exitoso. En caso contrario,
 * retorna los objetos sin mutar más un mensaje de error.
 *
 * @param params - Reserva actual, habitación actual y estado del pago
 * @returns Resultado con estados actualizados o errores
 *
 * @see RN-CHECKOUT-003
 */
export function procesarCheckout(params: ProcesarCheckoutParams): ProcesarCheckoutResult {
  const { reserva, habitacion, pagoExitoso } = params;

  if (!pagoExitoso) {
    return {
      success: false,
      reserva: { ...reserva },
      habitacion: { ...habitacion },
      errors: ['El pago no fue procesado correctamente'],
    };
  }

  return {
    success: true,
    reserva: { ...reserva, estado: 'finalizada' },
    habitacion: { ...habitacion, estado: 'limpieza' },
    errors: [],
  };
}

/**
 * Verifica si ya existe un pago registrado para la reserva (CHECKOUT-013).
 *
 * Previene pagos duplicados antes de procesar un nuevo checkout.
 *
 * @param reservaId       - ID de la reserva a verificar
 * @param pagosExistentes - Lista de pagos/ventas existentes
 * @returns true si no hay pago duplicado, false con mensaje si ya existe
 *
 * @see RN-CHECKOUT-003 (pre-check)
 */
export function validarPagoDuplicado(
  reservaId: string,
  pagosExistentes: PagoExistente[]
): { valido: boolean; error: string | null } {
  const pagoPrev = pagosExistentes.find(p => p.reserva_id === reservaId);
  if (pagoPrev) {
    return { valido: false, error: 'Ya existe un pago registrado para esta reserva' };
  }
  return { valido: true, error: null };
}

// ---------------------------------------------------------------------------
// CHECKOUT-004: Validación de Método de Pago
// ---------------------------------------------------------------------------

/**
 * Valida que el método de pago sea uno de los soportados.
 *
 * @param metodo - Nombre del método de pago
 * @returns Resultado con indicación si requiere referencia (Yape/Plin)
 *
 * @see RN-CHECKOUT-004
 */
export function validarMetodoPago(metodo: string | null | undefined): ValidarMetodoPagoResult {
  if (!metodo || typeof metodo !== 'string' || metodo.trim() === '') {
    return { valido: false, requiere_referencia: false, error: 'Debe seleccionar un método de pago' };
  }

  const metodoLower = metodo.toLowerCase().trim();

  if (!METODOS_PAGO_VALIDOS.includes(metodoLower as MetodoPago)) {
    return { valido: false, requiere_referencia: false, error: `Método de pago "${metodo}" no es válido` };
  }

  const requiereReferencia = METODOS_CON_REFERENCIA.includes(metodoLower as MetodoPago);

  return {
    valido: true,
    requiere_referencia: requiereReferencia,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// CHECKOUT-008: Validación de Referencia Yape/Plin
// ---------------------------------------------------------------------------

/**
 * Valida que los métodos Yape/Plin tengan un código de operación.
 *
 * @param params - Método y código de referencia ingresado
 * @returns Resultado de validación
 *
 * @see RN-CHECKOUT-004 (extensión para pagos digitales)
 */
export function validarReferenciaYapePlin(params: ValidarReferenciaParams): ValidarReferenciaResult {
  const { metodo, codigoReferencia } = params;

  if (
    METODOS_CON_REFERENCIA.includes(metodo.toLowerCase().trim() as MetodoPago) &&
    (!codigoReferencia || codigoReferencia.trim() === '')
  ) {
    return { valido: false, error: `El código de operación es obligatorio para ${metodo}` };
  }

  return { valido: true, error: null };
}

// ---------------------------------------------------------------------------
// CHECKOUT-005/006/007: Validación de Comprobante SUNAT
// ---------------------------------------------------------------------------

/**
 * Valida los datos del cliente según el tipo de comprobante SUNAT.
 *
 * Factura:
 *   - RUC obligatorio, formato 11 dígitos numéricos
 *   - Razón social obligatoria, mínimo 3 caracteres
 *
 * Boleta:
 *   - DNI/documento obligatorio
 *   - Nombre obligatorio, mínimo 3 caracteres
 *
 * @param params - Tipo de comprobante y datos del cliente
 * @returns Resultado con lista de errores de validación
 *
 * @see RN-CHECKOUT-005
 * @see venta.schema.ts
 */
export function validarComprobante(params: ValidarComprobanteParams): ValidarComprobanteResult {
  const { tipo, ruc, razonSocial, dni, nombre } = params;
  const errors: string[] = [];

  if (tipo === 'factura') {
    if (!ruc || !/^\d{11}$/.test(ruc.trim())) {
      errors.push('El RUC debe tener exactamente 11 dígitos numéricos');
    }
    if (!razonSocial || razonSocial.trim().length < 3) {
      errors.push('La razón social es obligatoria (mín. 3 caracteres)');
    }
  } else if (tipo === 'boleta') {
    if (!dni || !/^\d{8}$/.test(dni.trim())) {
      errors.push('El DNI debe tener exactamente 8 dígitos numéricos');
    }
    if (!nombre || nombre.trim().length < 3) {
      errors.push('El nombre del cliente es obligatorio (mín. 3 caracteres)');
    }
  }
  // tipo === 'ninguno' → sin validación, siempre válido

  return {
    valido: errors.length === 0,
    errors,
  };
}
