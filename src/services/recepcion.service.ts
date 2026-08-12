/**
 * recepcion.service.ts — Lógica pura del dominio Recepción / Check-in / Reservas
 *
 * Este servicio contiene TODAS las funciones de cálculo, validación y transición
 * de estados del flujo de recepción, aisladas de efectos secundarios (DB, UI, API).
 *
 * @see specs/domain-recepcion.md
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type TipoDocumento = 'DNI' | 'RUC' | 'pasaporte' | 'CE';
export type EstadoReserva = 'pendiente' | 'confirmada' | 'activa' | 'finalizada' | 'cancelada';
export type EstadoHabitacion = 'disponible' | 'ocupada' | 'reservada' | 'mantenimiento' | 'limpieza';
export type TipoTarifa = 'temporada' | 'dia_semana';

export interface ValidarDocumentoParams {
  tipo: TipoDocumento;
  documento: string;
}

export interface ValidarDocumentoResult {
  valido: boolean;
  error: string | null;
}

export interface CalcularNochesParams {
  fechaEntrada: string;  // yyyy-MM-dd
  fechaSalida: string;   // yyyy-MM-dd
}

export interface VerificarDisponibilidadParams {
  habitacionId: string;
  fechaEntrada: string;
  fechaSalida: string;
  reservasExistentes: ReservaExistente[];
}

export interface ReservaExistente {
  habitacion_id: string;
  fecha_entrada: string;
  fecha_salida: string;
  estado: string;
}

export interface ReglaTarifa {
  id: string;
  nombre: string;
  tipo: TipoTarifa;
  fecha_inicio?: string;    // yyyy-MM-dd (para tipo 'temporada')
  fecha_fin?: string;       // yyyy-MM-dd (para tipo 'temporada')
  dias_semana?: number[];   // 0=Dom, 1=Lun, ..., 6=Sáb (para tipo 'dia_semana')
  habitacion_tipo: string;  // 'todos' | tipo específico
  factor_ajuste: number;    // ej. 1.25 = +25%, 0.80 = -20%
}

export interface CalcularTarifaParams {
  fechaEntrada: string;     // yyyy-MM-dd
  fechaSalida: string;      // yyyy-MM-dd
  precioBase: number;
  tarifas?: ReglaTarifa[];
  habitacionTipo?: string;
  incluyeIgv?: boolean;
}

export interface CalcularTarifaResult {
  total: number;
  noches: number;
  precioBase: number;
  tarifaSinIgv: number;
  igvMonto: number;
  explicacion: string;
}

export interface TransicionHabitacionParams {
  accion: 'check-in' | 'check-out' | 'cancelar' | 'mantenimiento' | 'limpieza';
  conLimpieza?: boolean;
}

export interface TransicionReservaParams {
  estadoActual: EstadoReserva;
  accion: 'check-in' | 'check-out' | 'cancelar';
}

export interface TransicionResult {
  nuevoEstado: string;
  valido: boolean;
  error?: string;
}

export interface ValidarReservaParams {
  habitacionId: string;
  huespedNombre: string;
  tipoDocumento: TipoDocumento;
  huespedDni: string;
  fechaEntrada: string;
  fechaSalida: string;
  numAdultos: number;
  tieneMenores: boolean;
  observaciones?: string;
}

export interface ValidarReservaResult {
  valido: boolean;
  errors: string[];
}

export interface CheckinPublicoData {
  hotel_id: string;
  huesped_nombre: string;
  tipo_documento: TipoDocumento;
  huesped_dni: string;
  huesped_sexo?: string;
  huesped_fecha_nacimiento?: string;
  huesped_telefono?: string;
  huesped_email?: string;
  huesped_procedencia?: string;
  huesped_destino?: string;
  motivo_viaje?: string;
  nacionalidad?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

/** Tasa fija de IGV en Perú (18%) */
export const TASA_IGV = 0.18;

/** Estados válidos de habitación */
export const ESTADOS_HABITACION: EstadoHabitacion[] = [
  'disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza',
];

/** Estados válidos de reserva */
export const ESTADOS_RESERVA: EstadoReserva[] = [
  'pendiente', 'confirmada', 'activa', 'finalizada', 'cancelada',
];

/** Transiciones válidas de habitación (RN-REC-001) */
export const TRANSICIONES_HABITACION: Record<EstadoHabitacion, EstadoHabitacion[]> = {
  disponible:   ['ocupada', 'reservada', 'mantenimiento'],
  ocupada:      ['disponible', 'limpieza'],
  reservada:    ['ocupada', 'disponible'],
  limpieza:     ['disponible'],
  mantenimiento: ['disponible'],
};

/** Transiciones válidas de reserva (RN-REC-002) */
export const TRANSICIONES_RESERVA: Record<EstadoReserva, EstadoReserva[]> = {
  pendiente:   ['activa', 'cancelada'],
  confirmada:  ['activa', 'cancelada'],
  activa:      ['finalizada', 'cancelada'],
  finalizada:  [],
  cancelada:   [],
};

// ---------------------------------------------------------------------------
// RN-REC-003: Validación de Documento
// ---------------------------------------------------------------------------

/**
 * Valida el formato del documento según su tipo.
 *
 * DNI:       exactamente 8 dígitos numéricos
 * RUC:       exactamente 11 dígitos numéricos
 * Pasaporte: 6-15 caracteres alfanuméricos
 * CE:        mínimo 4 caracteres
 *
 * @param params - Tipo de documento y número
 * @returns Resultado de validación
 *
 * @see RN-REC-003
 */
export function validarDocumento(params: ValidarDocumentoParams): ValidarDocumentoResult {
  const { tipo, documento } = params;

  if (!documento || documento.trim() === '') {
    return { valido: false, error: 'El número de documento es obligatorio' };
  }

  const doc = documento.trim();

  switch (tipo) {
    case 'DNI':
      if (!/^\d{8}$/.test(doc)) {
        return { valido: false, error: 'El DNI debe tener exactamente 8 dígitos numéricos' };
      }
      break;
    case 'RUC':
      if (!/^\d{11}$/.test(doc)) {
        return { valido: false, error: 'El RUC debe tener exactamente 11 dígitos numéricos' };
      }
      break;
    case 'pasaporte':
      if (doc.length < 6 || doc.length > 15) {
        return { valido: false, error: 'El pasaporte debe tener entre 6 y 15 caracteres' };
      }
      break;
    case 'CE':
      if (doc.length < 4) {
        return { valido: false, error: 'La CE debe tener al menos 4 caracteres' };
      }
      break;
    default:
      return { valido: false, error: `Tipo de documento "${tipo}" no soportado` };
  }

  return { valido: true, error: null };
}

// ---------------------------------------------------------------------------
// RN-REC-003/004: Validación de Reserva
// ---------------------------------------------------------------------------

/**
 * Valida los datos obligatorios de una reserva antes de crear.
 *
 * @param params - Datos de la reserva a validar
 * @returns Resultado con lista de errores
 *
 * @see RN-REC-003
 */
export function validarReserva(params: ValidarReservaParams): ValidarReservaResult {
  const errors: string[] = [];

  // Habitación obligatoria
  if (!params.habitacionId || params.habitacionId.trim() === '') {
    errors.push('Debes seleccionar una habitación');
  }

  // Nombre obligatorio (min 3 caracteres)
  if (!params.huespedNombre || params.huespedNombre.trim().length < 3) {
    errors.push('El nombre del huésped debe tener al menos 3 caracteres');
  }

  // Documento obligatorio y válido
  const docResult = validarDocumento({ tipo: params.tipoDocumento, documento: params.huespedDni });
  if (!docResult.valido) {
    errors.push(docResult.error || 'Documento inválido');
  }

  // Fechas válidas (RN-REC-004)
  const nochesResult = calcularNoches({
    fechaEntrada: params.fechaEntrada,
    fechaSalida: params.fechaSalida,
  });
  if (!nochesResult.valido) {
    errors.push('La fecha de salida debe ser posterior a la fecha de entrada');
  }

  // Mínimo 1 adulto
  if (params.numAdultos < 1) {
    errors.push('Debe haber al menos 1 adulto');
  }

  // Menores de edad requieren observaciones (RN-REC-007)
  if (params.tieneMenores) {
    if (!params.observaciones || params.observaciones.trim().length <= 5) {
      errors.push('Detalle los Nombres y DNI de los menores de edad en las observaciones (Ley N° 30802)');
    }
  }

  return {
    valido: errors.length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// RN-REC-004: Cálculo de Noches
// ---------------------------------------------------------------------------

/**
 * Calcula la cantidad de noches entre dos fechas.
 *
 * Regla: noches = fecha_salida - fecha_entrada (en días)
 * Si noches ≤ 0 → retorna 1 (mínimo 1 noche).
 *
 * Las fechas se parsean con hora fija 12:00:00 para evitar bugs de timezone.
 *
 * @param params - Fechas de entrada y salida (yyyy-MM-dd)
 * @returns Cantidad de noches (mínimo 1)
 *
 * @see RN-REC-004
 */
export function calcularNoches(params: CalcularNochesParams): { noches: number; valido: boolean } {
  const { fechaEntrada, fechaSalida } = params;

  if (!fechaEntrada || !fechaSalida) {
    return { noches: 1, valido: false };
  }

  const entrada = new Date(fechaEntrada + 'T12:00:00');
  const salida = new Date(fechaSalida + 'T12:00:00');

  const diffMs = salida.getTime() - entrada.getTime();
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const noches = diffDias > 0 ? diffDias : 1;
  const valido = diffDias > 0;

  return { noches, valido };
}

// ---------------------------------------------------------------------------
// RN-REC-005: Tarifas Dinámicas
// ---------------------------------------------------------------------------

/**
 * Calcula la tarifa dinámica para una estadía completa.
 *
 * Evalúa CADA día individualmente con prioridad:
 *   1. Temporada específica (fecha_inicio ≤ día ≤ fecha_fin)
 *   2. Día de la semana
 *   3. Tarifa base
 *
 * @param params - Parámetros del cálculo de tarifa
 * @returns Desglose completo con total, noches, IGV y explicación
 *
 * @see RN-REC-005
 */
export function calcularTarifaDinamica(params: CalcularTarifaParams): CalcularTarifaResult {
  const {
    fechaEntrada,
    fechaSalida,
    precioBase,
    tarifas = [],
    habitacionTipo = 'todos',
    incluyeIgv = true,
  } = params;

  const { noches } = calcularNoches({ fechaEntrada, fechaSalida });

  let totalAcumulado = 0;
  const explicacionAjustes: string[] = [];

  const entrada = new Date(fechaEntrada + 'T12:00:00');

  for (let i = 0; i < noches; i++) {
    const diaEvaluado = new Date(entrada.getTime() + i * 24 * 60 * 60 * 1000);
    const diaSemana = diaEvaluado.getDay();
    // Usar métodos locales en vez de toISOString() para evitar desfase por timezone
    const year = diaEvaluado.getFullYear();
    const month = String(diaEvaluado.getMonth() + 1).padStart(2, '0');
    const day = String(diaEvaluado.getDate()).padStart(2, '0');
    const fechaStr = `${year}-${month}-${day}`;

    let factorAplicado = 1.0;
    let reglaNombre = '';

    // Filtrar reglas aplicables al tipo de habitación
    const reglasAplicables = tarifas.filter(t =>
      t.habitacion_tipo === 'todos' || t.habitacion_tipo === habitacionTipo
    );

    // 1. Prioridad: Temporadas Específicas
    const reglaTemporada = reglasAplicables.find(t =>
      t.tipo === 'temporada' &&
      t.fecha_inicio !== undefined && t.fecha_inicio <= fechaStr &&
      t.fecha_fin !== undefined && t.fecha_fin >= fechaStr
    );

    if (reglaTemporada) {
      factorAplicado = Number(reglaTemporada.factor_ajuste);
      reglaNombre = reglaTemporada.nombre;
    } else {
      // 2. Prioridad: Días de la Semana
      const reglaDia = reglasAplicables.find(t =>
        t.tipo === 'dia_semana' &&
        t.dias_semana !== undefined && t.dias_semana.includes(diaSemana)
      );
      if (reglaDia) {
        factorAplicado = Number(reglaDia.factor_ajuste);
        reglaNombre = reglaDia.nombre;
      }
    }

    totalAcumulado += precioBase * factorAplicado;

    if (factorAplicado !== 1.0 && !explicacionAjustes.includes(reglaNombre)) {
      const signo = factorAplicado >= 1.0 ? '+' : '';
      const porcentaje = Math.round((factorAplicado - 1.0) * 100);
      explicacionAjustes.push(`${reglaNombre} (${signo}${porcentaje}%)`);
    }
  }

  const tarifaSinIgv = incluyeIgv ? totalAcumulado / (1 + TASA_IGV) : totalAcumulado;
  const igvMonto = incluyeIgv ? totalAcumulado - tarifaSinIgv : 0;

  return {
    total: Math.round(totalAcumulado * 100) / 100,
    noches,
    precioBase,
    tarifaSinIgv: Math.round(tarifaSinIgv * 100) / 100,
    igvMonto: Math.round(igvMonto * 100) / 100,
    explicacion: explicacionAjustes.join(' · '),
  };
}

// ---------------------------------------------------------------------------
// RN-REC-005: Desglose de IGV
// ---------------------------------------------------------------------------

/**
 * Calcula el desglose de IGV para un monto total.
 *
 * @param total - Monto total (con IGV incluido si aplica)
 * @param incluyeIgv - true si el hotel aplica IGV
 * @returns Desglose con base imponible, IGV y total final
 *
 * @see RN-REC-005
 */
export function calcularDesgloseIGV(total: number, incluyeIgv: boolean): {
  baseImponible: number;
  igv: number;
  totalFinal: number;
} {
  if (!incluyeIgv) {
    return { baseImponible: total, igv: 0, totalFinal: total };
  }

  const baseImponible = total / (1 + TASA_IGV);
  const igv = total - baseImponible;

  return {
    baseImponible: Math.round(baseImponible * 100) / 100,
    igv: Math.round(igv * 100) / 100,
    totalFinal: total,
  };
}

// ---------------------------------------------------------------------------
// RN-REC-013: Verificación de Disponibilidad
// ---------------------------------------------------------------------------

/**
 * Verifica si una habitación está disponible para un rango de fechas.
 *
 * Choque = (fecha_entrada_nueva < fecha_salida_existente)
 *          Y (fecha_salida_nueva > fecha_entrada_existente)
 *
 * Solo se consideran reservas con estado 'pendiente' o 'activa'.
 *
 * @param params - Datos para verificar disponibilidad
 * @returns true si la habitación está disponible
 *
 * @see RN-REC-013
 */
export function verificarDisponibilidad(params: VerificarDisponibilidadParams): boolean {
  const { habitacionId, fechaEntrada, fechaSalida, reservasExistentes } = params;

  const nuevaEntrada = new Date(fechaEntrada + 'T12:00:00');
  const nuevaSalida = new Date(fechaSalida + 'T12:00:00');

  // Solo considerar reservas activas o pendientes que apliquen a esta habitación
  const reservasApliables = reservasExistentes.filter(r =>
    r.habitacion_id === habitacionId &&
    (r.estado === 'pendiente' || r.estado === 'activa' || r.estado === 'confirmada')
  );

  return !reservasApliables.some(r => {
    const resEntrada = new Date(r.fecha_entrada + 'T12:00:00');
    const resSalida = new Date(r.fecha_salida + 'T12:00:00');
    return nuevaEntrada < resSalida && nuevaSalida > resEntrada;
  });
}

// ---------------------------------------------------------------------------
// RN-REC-001: Transición de Estado de Habitación
// ---------------------------------------------------------------------------

/**
 * Calcula el nuevo estado de una habitación según la acción realizada.
 *
 * Transiciones válidas (RN-REC-001):
 *   libre → ocupada (check-in)
 *   libre → reservada (reserva futura)
 *   libre → mantenimiento (por admin)
 *   ocupada → libre (check-out)
 *   ocupada → limpieza (check-out + limpieza)
 *   reservada → ocupada (check-in de reserva futura)
 *   reservada → libre (cancelación)
 *   limpieza → libre (limpieza completada)
 *   mantenimiento → libre (mantenimiento completado)
 *
 * @param params - Acción y parámetros adicionales
 * @returns Nuevo estado y si la transición es válida
 *
 * @see RN-REC-001
 */
export function calcularTransicionHabitacion(params: TransicionHabitacionParams): TransicionResult {
  const { accion, conLimpieza = false } = params;

  const mapaTransiciones: Record<string, EstadoHabitacion> = {
    'check-in': 'ocupada',
    'check-out': conLimpieza ? 'limpieza' : 'disponible',
    'cancelar': 'disponible',
    'mantenimiento': 'mantenimiento',
    'limpieza': 'disponible',
  };

  const nuevoEstado = mapaTransiciones[accion];

  if (!nuevoEstado) {
    return { nuevoEstado: '', valido: false, error: `Acción "${accion}" no reconocida` };
  }

  return { nuevoEstado, valido: true };
}

/**
 * Valida si una transición de habitación es permitida.
 *
 * @param estadoActual - Estado actual de la habitación
 * @param nuevoEstado - Estado destino deseado
 * @returns true si la transición es válida
 *
 * @see RN-REC-001
 */
export function esTransicionHabitacionValida(
  estadoActual: EstadoHabitacion,
  nuevoEstado: EstadoHabitacion
): boolean {
  const transicionesPermitidas = TRANSICIONES_HABITACION[estadoActual];
  return transicionesPermitidas ? transicionesPermitidas.includes(nuevoEstado) : false;
}

// ---------------------------------------------------------------------------
// RN-REC-002: Transición de Estado de Reserva
// ---------------------------------------------------------------------------

/**
 * Valida si una transición de reserva es permitida.
 *
 * @param estadoActual - Estado actual de la reserva
 * @param accion - Acción a realizar
 * @returns Resultado con nuevo estado y si es válido
 *
 * @see RN-REC-002
 */
export function calcularTransicionReserva(
  estadoActual: EstadoReserva,
  accion: 'check-in' | 'check-out' | 'cancelar'
): TransicionResult {
  const mapaTransiciones: Record<EstadoReserva, Record<string, EstadoReserva>> = {
    pendiente:   { 'check-in': 'activa', 'cancelar': 'cancelada' },
    confirmada:  { 'check-in': 'activa', 'cancelar': 'cancelada' },
    activa:      { 'check-out': 'finalizada', 'cancelar': 'cancelada' },
    finalizada:  {},
    cancelada:   {},
  };

  const transiciones = mapaTransiciones[estadoActual];
  if (!transiciones || !transiciones[accion]) {
    return {
      nuevoEstado: estadoActual,
      valido: false,
      error: `No se puede realizar "${accion}" desde el estado "${estadoActual}"`,
    };
  }

  return { nuevoEstado: transiciones[accion], valido: true };
}

// ---------------------------------------------------------------------------
// RN-REC-008: Reserva Online
// ---------------------------------------------------------------------------

/**
 * Genera el número de reserva para una reserva online.
 *
 * Formato: 'W' + timestamp (ej. "W123456")
 *
 * @returns Número de reserva único
 *
 * @see RN-REC-008
 */
export function generarNumeroReservaOnline(): string {
  return `W${Date.now().toString().slice(-6)}`;
}

/**
 * Crea el payload para una reserva online con estado 'pendiente'.
 *
 * @param datosHuésped - Datos del huésped del formulario
 * @param datosHabitación - Datos de la habitación seleccionada
 * @returns Payload completo para insertar en BD
 *
 * @see RN-REC-008
 */
export function construirPayloadReservaOnline(params: {
  hotelId: string;
  habitacionId: string;
  habitacionNumero: string;
  habitacionTipo: string;
  huespedNombre: string;
  huespedDni: string;
  huespedTelefono?: string;
  huespedEmail?: string;
  fechaEntrada: string;
  fechaSalida: string;
  precioBase: number;
  total: number;
  numAdultos?: number;
  numNinos?: number;
  observaciones?: string;
}) {
  const { noches } = calcularNoches({
    fechaEntrada: params.fechaEntrada,
    fechaSalida: params.fechaSalida,
  });

  return {
    hotel_id: params.hotelId,
    habitacion_id: params.habitacionId,
    habitacion_numero: params.habitacionNumero,
    habitacion_tipo: params.habitacionTipo,
    huesped_nombre: params.huespedNombre,
    huesped_dni: params.huespedDni,
    huesped_telefono: params.huespedTelefono || '',
    huesped_email: params.huespedEmail || '',
    fecha_entrada: params.fechaEntrada,
    fecha_salida: params.fechaSalida,
    noches,
    precio_noche: params.precioBase,
    total: params.total,
    num_adultos: params.numAdultos || 1,
    num_ninos: params.numNinos || 0,
    estado: 'pendiente' as EstadoReserva,
    numero_reserva: generarNumeroReservaOnline(),
    observaciones: params.observaciones?.trim()
      ? `[AUTO-RESERVA ONLINE] ${params.observaciones.trim()}`
      : '[AUTO-RESERVA ONLINE]',
  };
}

// ---------------------------------------------------------------------------
// RN-REC-009: Auditoría
// ---------------------------------------------------------------------------

/**
 * Construye la descripción de auditoría para una acción de recepción.
 *
 * Formatos:
 *   CHECK-IN  → `Check-in: Hab. {numero} - {nombre} - {fecha_entrada}`
 *   CHECK-OUT → `Check-out: Hab. {numero} - {nombre} - S/ {total}`
 *   CANCELAR  → `Reserva cancelada: {numero_reserva} - {nombre}`
 *
 * @param accion - Tipo de acción
 * @param datos - Datos de la reserva/habitación
 * @returns Descripción formateada para audit_log
 *
 * @see RN-REC-009
 */
export function construirDescripcionAuditoria(
  accion: 'CHECK-IN' | 'CHECK-OUT' | 'CANCELAR',
  datos: {
    habitacionNumero?: string;
    huespedNombre: string;
    fechaEntrada?: string;
    total?: number;
    numeroReserva?: string;
  }
): string {
  switch (accion) {
    case 'CHECK-IN':
      return `Check-in: Hab. ${datos.habitacionNumero || '?'} - ${datos.huespedNombre} - ${datos.fechaEntrada || '?'}`;
    case 'CHECK-OUT':
      return `Check-out: Hab. ${datos.habitacionNumero || '?'} - ${datos.huespedNombre} - S/ ${datos.total?.toFixed(2) || '0.00'}`;
    case 'CANCELAR':
      return `Reserva cancelada: ${datos.numeroReserva || '?'} - ${datos.huespedNombre}`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// RN-REC-017: Pre-check-in
// ---------------------------------------------------------------------------

/**
 * Construye el payload para insertar un pre-check-in público.
 *
 * @param hotelId - ID del hotel
 * @param datos - Datos del formulario de pre-check-in
 * @returns Payload para insertar en checkins_publicos
 *
 * @see RN-REC-017
 */
export function construirPayloadPreCheckin(hotelId: string, datos: CheckinPublicoData) {
  return {
    hotel_id: hotelId,
    huesped_nombre: datos.huesped_nombre,
    tipo_documento: datos.tipo_documento,
    huesped_dni: datos.huesped_dni,
    huesped_sexo: datos.huesped_sexo || 'no_especificado',
    huesped_fecha_nacimiento: datos.huesped_fecha_nacimiento || '',
    huesped_telefono: datos.huesped_telefono || '',
    huesped_email: datos.huesped_email || '',
    huesped_procedencia: datos.huesped_procedencia || '',
    huesped_destino: datos.huesped_destino || '',
    motivo_viaje: datos.motivo_viaje || 'turismo',
    nacionalidad: datos.nacionalidad || 'Peruana',
  };
}

/**
 * Extrae datos de un pre-check-in para auto-llenar el formulario de reserva.
 *
 * @param preCheckin - Registro de checkins_publicos
 * @returns Objeto con los campos mapeados para el formulario
 *
 * @see RN-REC-017
 */
export function extraerDatosPreCheckin(preCheckin: Record<string, any>) {
  return {
    huesped_nombre: preCheckin.huesped_nombre || '',
    tipo_documento: preCheckin.tipo_documento || 'DNI',
    huesped_dni: preCheckin.huesped_dni || '',
    huesped_sexo: preCheckin.huesped_sexo || 'no_especificado',
    huesped_fecha_nacimiento: preCheckin.huesped_fecha_nacimiento || '',
    huesped_telefono: preCheckin.huesped_telefono || '',
    huesped_email: preCheckin.huesped_email || '',
    huesped_procedencia: preCheckin.huesped_procedencia || '',
    huesped_destino: preCheckin.huesped_destino || '',
    motivo_viaje: preCheckin.motivo_viaje || 'turismo',
    nacionalidad: preCheckin.nacionalidad || 'Peruana',
    pre_checkin_id: preCheckin.id,
  };
}
