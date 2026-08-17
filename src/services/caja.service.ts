/**
 * caja.service.ts — Lógica pura del dominio Caja / Egresos / Cierres
 *
 * Este servicio contiene funciones de cálculo de estadísticas de caja,
 * validación de egresos y cierres, y desglose por método de pago y SUNAT,
 * aisladas de efectos secundarios (DB, UI, API).
 *
 * @see src/pages/Caja.jsx
 * @see src/hooks/useCajaStats.js
 * @see src/schemas/caja.schema.ts
 * @see specs/domain-checkout.md (sección financiera)
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type { MetodoPago } from '@/constants/paymentMethods';
export type { EstadoComprobante } from '@/constants/comprobantes';
export type CategoriaEgreso = 'operativo' | 'servicios' | 'insumos' | 'mantenimiento' | 'personal' | 'otros';
export type PeriodoFiltro = 'hoy' | 'semana' | 'todo';

export interface VentaRegistro {
  id?: string;
  monto_pagado?: number;
  total?: number;
  metodo_pago?: string;
  estado_comprobante?: EstadoComprobante;
  fecha_pago?: string;
  fecha_venta?: string;
  created_date?: string;
  cliente_nombre?: string;
  habitacion_numero?: string;
}

export interface EgresoRegistro {
  id?: string;
  monto: number;
  concepto: string;
  categoria: CategoriaEgreso;
  fecha?: string;
  created_date?: string;
  usuario_id?: string;
  usuario_nombre?: string;
  insumo_id?: string;
  cantidad_insumo?: number;
}

export interface CierreCaja {
  id?: string;
  hotel_id?: string;
  fecha: string;
  total_ventas: number;
  total_egresos: number;
  saldo_final: number;
  usuario_id?: string;
  usuario_nombre?: string;
  notas?: string;
}

export interface CajaStats {
  ingresos: number;
  hotel: number;
  pos: number;
  egresos: number;
  balance: number;
  balanceEfectivo: number;
  metodos: Record<MetodoPago, number>;
  countHotel: number;
  countPOS: number;
  countEgresos: number;
  sunatDeclaradasCount: number;
  sunatDeclaradasTotal: number;
  sunatPendientesCount: number;
  sunatPendientesTotal: number;
  sunatRechazadasCount: number;
  sunatRechazadasTotal: number;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export { METODOS_PAGO } from '@/constants/paymentMethods';

export const CATEGORIAS_EGRESO: CategoriaEgreso[] = [
  'operativo', 'servicios', 'insumos', 'mantenimiento', 'personal', 'otros',
];

export const ESTADOS_COMPROBANTE_SUNAT: EstadoComprobante[] = [
  'ticket_interno', 'sunat_pendiente', 'sunat_emitido', 'sunat_rechazado',
];

// ---------------------------------------------------------------------------
// Helper: Filtrar ventas por fecha
// ---------------------------------------------------------------------------

/**
 * Filtra un array de registros para incluir solo los de una fecha específica.
 *
 * @param registros - Lista de registros con campos de fecha
 * @param fechaReferencia - Fecha contra la cual comparar (default: hoy)
 * @param camposFecha - Campos de fecha a evaluar en orden de prioridad
 * @returns Registros que coinciden con la fecha
 */
export function filtrarPorFecha(
  registros: VentaRegistro[] | EgresoRegistro[],
  fechaReferencia: Date = new Date(),
  ...camposFecha: string[]
): any[] {
  const refStr = fechaReferencia.toISOString().split('T')[0];

  return registros.filter(r => {
    for (const campo of camposFecha.length > 0 ? camposFecha : ['fecha_pago', 'fecha_venta', 'created_date', 'fecha']) {
      const val = (r as any)[campo];
      if (val) {
        const fechaStr = new Date(val).toISOString().split('T')[0];
        if (fechaStr === refStr) return true;
        break; // Solo evaluar el primer campo con valor
      }
    }
    return false;
  });
}

/**
 * Filtra registros por período.
 *
 * @param registros - Lista de registros
 * @param periodo - 'hoy' | 'semana' | 'todo'
 * @param camposFecha - Campos de fecha a evaluar
 * @returns Registros filtrados por período
 */
export function filtrarPorPeriodo(
  registros: (VentaRegistro | EgresoRegistro)[],
  periodo: PeriodoFiltro,
  ...camposFecha: string[]
): any[] {
  if (periodo === 'todo') return registros;

  const ahora = new Date();

  if (periodo === 'hoy') {
    return filtrarPorFecha(registros, ahora, ...camposFecha);
  }

  // periodo === 'semana'
  const hace7Dias = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const hace7Str = hace7Dias.toISOString().split('T')[0];

  return registros.filter(r => {
    for (const campo of camposFecha.length > 0 ? camposFecha : ['fecha_pago', 'fecha_venta', 'created_date', 'fecha']) {
      const val = (r as any)[campo];
      if (val) {
        const fechaStr = new Date(val).toISOString().split('T')[0];
        return fechaStr >= hace7Str;
      }
    }
    return false;
  });
}

// ---------------------------------------------------------------------------
// CAJ-001: Calcular estadísticas del día
// ---------------------------------------------------------------------------

/**
 * Calcula el desglose de métodos de pago a partir de ventas.
 *
 * @param ventas - Lista de ventas (hotel + POS)
 * @returns Objeto con total por cada método de pago
 */
export function calcularDesgloseMetodosPago(
  ventas: VentaRegistro[]
): Record<MetodoPago, number> {
  const metodos: Record<MetodoPago, number> = {
    efectivo: 0,
    yape: 0,
    plin: 0,
    transferencia: 0,
    tarjeta: 0,
  };

  for (const v of ventas) {
    const metodo = (v.metodo_pago || 'efectivo').toLowerCase() as MetodoPago;
    const monto = Number(v.monto_pagado || v.total || 0);
    if (metodos[metodo] !== undefined) {
      metodos[metodo] += monto;
    } else {
      metodos.efectivo += monto; // fallback
    }
  }

  return metodos;
}

/**
 * Calcula el balance de efectivo real en caja.
 *
 * Fórmula: balanceEfectivo = totalEfectivo - totalEgresos
 *
 * @param totalEfectivo - Suma de pagos en efectivo
 * @param totalEgresos - Suma de egresos registrados
 * @returns Balance de efectivo
 */
export function calcularBalanceEfectivo(
  totalEfectivo: number,
  totalEgresos: number
): number {
  return Math.round((totalEfectivo - totalEgresos) * 100) / 100;
}

export type EstadoArqueo = 'sin_conteo' | 'cuadrado' | 'faltante' | 'sobrante';

/**
 * Compara el efectivo que el sistema espera con el conteo físico del turno.
 * No altera el saldo contable: solo aporta una señal de auditoría para el cierre.
 */
export function evaluarArqueoEfectivo(
  efectivoEsperado: number,
  efectivoContado?: number | null
): {
  estado: EstadoArqueo;
  diferencia: number;
  requiereNota: boolean;
} {
  if (efectivoContado === null || efectivoContado === undefined || Number.isNaN(Number(efectivoContado))) {
    return { estado: 'sin_conteo', diferencia: 0, requiereNota: false };
  }

  const diferencia = Math.round((Number(efectivoContado) - Number(efectivoEsperado || 0)) * 100) / 100;
  if (Math.abs(diferencia) <= 0.01) {
    return { estado: 'cuadrado', diferencia: 0, requiereNota: false };
  }

  return {
    estado: diferencia < 0 ? 'faltante' : 'sobrante',
    diferencia,
    requiereNota: true,
  };
}

/**
 * Calcula el desglose de estados SUNAT a partir de ventas.
 *
 * @param ventas - Lista de ventas con estado_comprobante
 * @returns Desglose de SUNAT (declaradas, pendientes, rechazadas)
 */
export function calcularDesgloseSunat(
  ventas: VentaRegistro[]
): {
  sunatDeclaradasCount: number;
  sunatDeclaradasTotal: number;
  sunatPendientesCount: number;
  sunatPendientesTotal: number;
  sunatRechazadasCount: number;
  sunatRechazadasTotal: number;
} {
  let declaradasCount = 0;
  let declaradasTotal = 0;
  let pendientesCount = 0;
  let pendientesTotal = 0;
  let rechazadasCount = 0;
  let rechazadasTotal = 0;

  for (const v of ventas) {
    const totalVal = Number(v.monto_pagado || v.total || 0);
    const estado = v.estado_comprobante;

    switch (estado) {
      case 'sunat_emitido':
        declaradasCount++;
        declaradasTotal += totalVal;
        break;
      case 'sunat_pendiente':
        pendientesCount++;
        pendientesTotal += totalVal;
        break;
      case 'sunat_rechazado':
        rechazadasCount++;
        rechazadasTotal += totalVal;
        break;
      // ticket_interno → no contar
    }
  }

  return {
    sunatDeclaradasCount: declaradasCount,
    sunatDeclaradasTotal: Math.round(declaradasTotal * 100) / 100,
    sunatPendientesCount: pendientesCount,
    sunatPendientesTotal: Math.round(pendientesTotal * 100) / 100,
    sunatRechazadasCount: rechazadasCount,
    sunatRechazadasTotal: Math.round(rechazadasTotal * 100) / 100,
  };
}

/**
 * Calcula todas las estadísticas de caja para un día/set de datos.
 *
 * @param ventasHotel - Ventas del hotel (hospedaje)
 * @param ventasPOS - Ventas del minimarket/POS
 * @param egresos - Egresos registrados
 * @returns Estadísticas completas de caja
 *
 * @see CAJ-001
 */
export function calcularCajaStats(
  ventasHotel: VentaRegistro[],
  ventasPOS: VentaRegistro[],
  egresos: EgresoRegistro[]
): CajaStats {
  const totalHotel = ventasHotel.reduce((acc, v) => acc + Number(v.monto_pagado || v.total || 0), 0);
  const totalPOS = ventasPOS.reduce((acc, v) => acc + Number(v.total || 0), 0);
  const totalIngresos = totalHotel + totalPOS;
  const totalEgresos = egresos.reduce((acc, e) => acc + Number(e.monto || 0), 0);

  const todasVentas = [...ventasHotel, ...ventasPOS];
  const metodos = calcularDesgloseMetodosPago(todasVentas);
  const balanceEfectivo = calcularBalanceEfectivo(metodos.efectivo, totalEgresos);
  const sunat = calcularDesgloseSunat(todasVentas);

  return {
    ingresos: Math.round(totalIngresos * 100) / 100,
    hotel: Math.round(totalHotel * 100) / 100,
    pos: Math.round(totalPOS * 100) / 100,
    egresos: Math.round(totalEgresos * 100) / 100,
    balance: Math.round((totalIngresos - totalEgresos) * 100) / 100,
    balanceEfectivo: Math.round(balanceEfectivo * 100) / 100,
    metodos,
    countHotel: ventasHotel.length,
    countPOS: ventasPOS.length,
    countEgresos: egresos.length,
    ...sunat,
  };
}

// ---------------------------------------------------------------------------
// CAJ-006: Validación de Egreso
// ---------------------------------------------------------------------------

/**
 * Valida los datos de un egreso antes de registrarlo.
 *
 * Reglas:
 *   - Monto debe ser > 0
 *   - Concepto debe tener al menos 3 caracteres
 *   - Categoría debe ser válida
 *   - Si categoría es 'insumos': insumo_id y cantidad_insumo obligatorios
 *
 * @param egreso - Datos del egreso a validar
 * @returns Resultado con lista de errores
 *
 * @see RN-CAJA-001
 */
export function validarEgreso(egreso: {
  monto: number;
  concepto: string;
  categoria: string;
  insumo_id?: string;
  cantidad_insumo?: number;
}): { valido: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!egreso.monto || egreso.monto <= 0) {
    errors.push('El monto debe ser mayor a 0');
  }

  if (!egreso.concepto || egreso.concepto.trim().length < 3) {
    errors.push('El concepto debe tener al menos 3 caracteres');
  }

  if (!egreso.categoria || !CATEGORIAS_EGRESO.includes(egreso.categoria as CategoriaEgreso)) {
    errors.push('La categoría seleccionada no es válida');
  }

  if (egreso.categoria === 'insumos') {
    if (!egreso.insumo_id || egreso.insumo_id.trim() === '') {
      errors.push('Debe seleccionar un insumo para esta categoría');
    }
    if (!egreso.cantidad_insumo || egreso.cantidad_insumo <= 0) {
      errors.push('Debe indicar una cantidad válida para el insumo');
    }
  }

  return {
    valido: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// CAJ-010: Validación de Cierre de Caja
// ---------------------------------------------------------------------------

/**
 * Prepara el payload para un cierre de caja.
 *
 * @param stats - Estadísticas actuales de caja
 * @param usuario - Datos del usuario que cierra
 * @param notas - Notas opcionales del cierre
 * @returns Payload para insertar el cierre
 *
 * @see CAJ-010
 */
export function prepararCierreCaja(
  stats: Pick<CajaStats, 'ingresos' | 'egresos' | 'balance'>,
  notas: string = ''
): {
  total_ventas: number;
  total_egresos: number;
  saldo_final: number;
  notas: string;
} {
  const saldo = Math.round((stats.ingresos - stats.egresos) * 100) / 100;

  return {
    total_ventas: Math.round(stats.ingresos * 100) / 100,
    total_egresos: Math.round(stats.egresos * 100) / 100,
    saldo_final: saldo,
    notas: notas.trim() || '',
  };
}

/**
 * Valida que el cierre tenga datos consistentes.
 *
 * Regla: saldo_final debe coincidir con total_ventas - total_egresos
 *
 * @param cierre - Datos del cierre a validar
 * @returns Resultado con lista de errores
 */
export function validarCierreCaja(cierre: {
  total_ventas: number;
  total_egresos: number;
  saldo_final: number;
}): { valido: boolean; errors: string[] } {
  const errors: string[] = [];
  const saldoEsperado = Math.round((cierre.total_ventas - cierre.total_egresos) * 100) / 100;

  if (cierre.total_ventas < 0) {
    errors.push('El total de ventas no puede ser negativo');
  }

  if (cierre.total_egresos < 0) {
    errors.push('El total de egresos no puede ser negativo');
  }

  if (Math.abs(cierre.saldo_final - saldoEsperado) > 0.01) {
    errors.push(`El saldo final (${cierre.saldo_final}) no coincide con ventas - egresos (${saldoEsperado})`);
  }

  return {
    valido: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helper: Totalizar Montos
// ---------------------------------------------------------------------------

/**
 * Suma los montos de un array de registros que tienen campo monto.
 *
 * @param egresos - Lista de egresos
 * @returns Suma total de montos
 */
export function totalizarMontos(egresos: EgresoRegistro[]): number {
  return Math.round(
    egresos.reduce((acc, e) => acc + Number(e.monto || 0), 0) * 100
  ) / 100;
}

/**
 * Suma los totales de un array de ventas.
 *
 * @param ventas - Lista de ventas
 * @returns Suma total
 */
export function totalizarVentas(ventas: VentaRegistro[]): number {
  return Math.round(
    ventas.reduce((acc, v) => acc + Number(v.monto_pagado || v.total || 0), 0) * 100
  ) / 100;
}
