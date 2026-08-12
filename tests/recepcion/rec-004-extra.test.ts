// @ts-nocheck
/**
 * REC-018 a REC-022: Tests adicionales de recepcion.service.ts
 *
 * Cubre funciones puras del servicio que no estaban testeadas:
 *   - validarReserva (completo)
 *   - calcularTransicionReserva
 *   - esTransicionHabitacionValida
 *   - validarDocumento edge cases
 *   - construirPayloadPreCheckin con defaults
 *
 * @see src/services/recepcion.service.ts
 */
import {
  validarReserva,
  validarDocumento,
  calcularTransicionReserva,
  esTransicionHabitacionValida,
  construirPayloadPreCheckin,
  calcularNoches,
  ESTADOS_HABITACION,
  ESTADOS_RESERVA,
} from '@/services/recepcion.service';

// ─── REC-018: validarReserva — Validación completa de reserva ────────────

describe('REC-018: validarReserva — Validación completa', () => {
  const baseValida = {
    habitacionId: 'hab-101',
    huespedNombre: 'Juan Pérez',
    tipoDocumento: 'DNI',
    huespedDni: '12345678',
    fechaEntrada: '2026-07-15',
    fechaSalida: '2026-07-18',
    numAdultos: 2,
    tieneMenores: false,
  };

  it('acepta reserva con todos los campos válidos', () => {
    const result = validarReserva(baseValida);
    expect(result.valido).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('rechaza reserva sin habitación', () => {
    const result = validarReserva({ ...baseValida, habitacionId: '' });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('habitación'))).toBe(true);
  });

  it('rechaza reserva sin nombre de huésped', () => {
    const result = validarReserva({ ...baseValida, huespedNombre: '' });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('nombre'))).toBe(true);
  });

  it('rechaza nombre con menos de 3 caracteres', () => {
    const result = validarReserva({ ...baseValida, huespedNombre: 'AB' });
    expect(result.valido).toBe(false);
  });

  it('rechaza documento inválido', () => {
    const result = validarReserva({ ...baseValida, huespedDni: '123' });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('DNI'))).toBe(true);
  });

  it('rechaza fechas inválidas (salida ≤ entrada)', () => {
    const result = validarReserva({
      ...baseValida,
      fechaEntrada: '2026-07-18',
      fechaSalida: '2026-07-15',
    });
    expect(result.valido).toBe(false);
  });

  it('rechaza sin adultos', () => {
    const result = validarReserva({ ...baseValida, numAdultos: 0 });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('adulto'))).toBe(true);
  });

  it('requiere observaciones detalladas si hay menores', () => {
    const result = validarReserva({
      ...baseValida,
      tieneMenores: true,
      observaciones: 'Corto',
    });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('menores'))).toBe(true);
  });

  it('acepta menores con observaciones válidas', () => {
    const result = validarReserva({
      ...baseValida,
      tieneMenores: true,
      observaciones: 'Menor: Mateo Pérez, DNI 77777777',
    });
    expect(result.valido).toBe(true);
  });

  it('acumula múltiples errores a la vez', () => {
    const result = validarReserva({
      habitacionId: '',
      huespedNombre: 'AB',
      tipoDocumento: 'DNI',
      huespedDni: '12',
      fechaEntrada: '2026-07-18',
      fechaSalida: '2026-07-15',
      numAdultos: 0,
      tieneMenores: false,
    });
    expect(result.valido).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ─── REC-019: calcularTransicionReserva ─────────────────────────────────

describe('REC-019: calcularTransicionReserva — Estados de reserva', () => {
  it('pendiente → activa (check-in)', () => {
    const result = calcularTransicionReserva('pendiente', 'check-in');
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('activa');
  });

  it('pendiente → cancelada', () => {
    const result = calcularTransicionReserva('pendiente', 'cancelar');
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('cancelada');
  });

  it('confirmada → activa (check-in)', () => {
    const result = calcularTransicionReserva('confirmada', 'check-in');
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('activa');
  });

  it('activa → finalizada (check-out)', () => {
    const result = calcularTransicionReserva('activa', 'check-out');
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('finalizada');
  });

  it('activa → cancelada', () => {
    const result = calcularTransicionReserva('activa', 'cancelar');
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('cancelada');
  });

  it('finalizada no permite ninguna transición', () => {
    const result = calcularTransicionReserva('finalizada', 'check-in');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('No se puede');
  });

  it('cancelada no permite ninguna transición', () => {
    const result = calcularTransicionReserva('cancelada', 'cancelar');
    expect(result.valido).toBe(false);
  });

  it('pendiente no permite check-out directo', () => {
    const result = calcularTransicionReserva('pendiente', 'check-out');
    expect(result.valido).toBe(false);
  });

  it('confirmada no permite check-out directo', () => {
    const result = calcularTransicionReserva('confirmada', 'check-out');
    expect(result.valido).toBe(false);
  });
});

// ─── REC-020: esTransicionHabitacionValida ──────────────────────────────

describe('REC-020: esTransicionHabitacionValida', () => {
  it('ocupada → disponible es válida', () => {
    expect(esTransicionHabitacionValida('ocupada', 'disponible')).toBe(true);
  });

  it('disponible → ocupada es válida', () => {
    expect(esTransicionHabitacionValida('disponible', 'ocupada')).toBe(true);
  });

  it('disponible → mantenimiento es válida', () => {
    expect(esTransicionHabitacionValida('disponible', 'mantenimiento')).toBe(true);
  });

  it('disponible → limpieza NO es válida', () => {
    expect(esTransicionHabitacionValida('disponible', 'limpieza')).toBe(false);
  });

  it('mantenimiento → disponible es válida', () => {
    expect(esTransicionHabitacionValida('mantenimiento', 'disponible')).toBe(true);
  });

  it('mantenimiento → ocupada NO es válida', () => {
    expect(esTransicionHabitacionValida('mantenimiento', 'ocupada')).toBe(false);
  });

  it('estado inexistente retorna false', () => {
    expect(esTransicionHabitacionValida('inexistente', 'disponible')).toBe(false);
  });
});

// ─── REC-021: Edge cases de validarDocumento ────────────────────────────

describe('REC-021: validarDocumento — Edge cases', () => {
  it('rechaza documento vacío', () => {
    expect(validarDocumento({ tipo: 'DNI', documento: '' }).valido).toBe(false);
  });

  it('rechaza documento null', () => {
    expect(validarDocumento({ tipo: 'DNI', documento: null }).valido).toBe(false);
  });

  it('rechaza tipo de documento no soportado', () => {
    const result = validarDocumento({ tipo: 'carnet', documento: 'ABC123' });
    expect(result.valido).toBe(false);
    expect(result.error).toContain('no soportado');
  });

  it('acepta CE con 4 caracteres', () => {
    expect(validarDocumento({ tipo: 'CE', documento: 'ABCD' }).valido).toBe(true);
  });

  it('rechaza CE con 3 caracteres', () => {
    expect(validarDocumento({ tipo: 'CE', documento: 'ABC' }).valido).toBe(false);
  });

  it('acepta pasaporte con 15 caracteres', () => {
    expect(validarDocumento({ tipo: 'pasaporte', documento: 'A'.repeat(15) }).valido).toBe(true);
  });

  it('rechaza pasaporte con 16 caracteres', () => {
    expect(validarDocumento({ tipo: 'pasaporte', documento: 'A'.repeat(16) }).valido).toBe(false);
  });
});

// ─── REC-022: construirPayloadPreCheckin con defaults ───────────────────

describe('REC-022: construirPayloadPreCheckin — Defaults', () => {
  it('usa valores por defecto para campos opcionales', () => {
    const payload = construirPayloadPreCheckin('hotel-001', {
      hotel_id: 'hotel-001',
      huesped_nombre: 'Juan Pérez',
      tipo_documento: 'DNI',
      huesped_dni: '12345678',
    });

    expect(payload.huesped_sexo).toBe('no_especificado');
    expect(payload.huesped_procedencia).toBe('');
    expect(payload.huesped_destino).toBe('');
    expect(payload.motivo_viaje).toBe('turismo');
    expect(payload.nacionalidad).toBe('Peruana');
    expect(payload.huesped_fecha_nacimiento).toBe('');
    expect(payload.huesped_telefono).toBe('');
    expect(payload.huesped_email).toBe('');
  });

  it('incluye hotel_id correcto', () => {
    const payload = construirPayloadPreCheckin('hotel-002', {
      hotel_id: 'hotel-002',
      huesped_nombre: 'Test',
      tipo_documento: 'DNI',
      huesped_dni: '12345678',
    });
    expect(payload.hotel_id).toBe('hotel-002');
  });
});

// ─── ESTADOS_RESERVA y calcularNoches edge cases ────────────────────────

describe('REC-022b: Constantes y edge cases', () => {
  it('ESTADOS_RESERVA contiene los 5 estados', () => {
    expect(ESTADOS_RESERVA).toEqual(
      expect.arrayContaining(['pendiente', 'confirmada', 'activa', 'finalizada', 'cancelada'])
    );
    expect(ESTADOS_RESERVA.length).toBe(5);
  });

  it('ESTADOS_HABITACION contiene los 5 estados', () => {
    expect(ESTADOS_HABITACION).toEqual(
      expect.arrayContaining(['disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza'])
    );
    expect(ESTADOS_HABITACION.length).toBe(5);
  });

  it('calcularNoches retorna valido=false si faltan fechas', () => {
    const result = calcularNoches({ fechaEntrada: '', fechaSalida: '' });
    expect(result.valido).toBe(false);
    expect(result.noches).toBe(1);
  });

  it('calcularNoches retorna valido=false si fecha es inválida', () => {
    const result = calcularNoches({ fechaEntrada: 'no-date', fechaSalida: '2026-07-15' });
    expect(result.valido).toBe(false);
    expect(result.noches).toBe(1);
  });
});
