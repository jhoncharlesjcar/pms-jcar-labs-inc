// @ts-nocheck
/**
 * HAB-001 a HAB-013: Tests de contrato del dominio Habitaciones
 *
 * Tests de contrato que validan CRUD, estados, validación,
 * eliminación protegida, grid y estadísticas.
 *
 * @see specs/domain-habitaciones.md — Sección 7
 */
import {
  validarHabitacion,
  formatearHabitacionParaBD,
  puedeEliminarHabitacion,
  cambiarEstadoHabitacion,
  agruparPorPiso,
  filtrarPorEstado,
  calcularEstadisticas,
  TIPOS_HABITACION,
  COLORES_ESTADO,
} from '@/services/habitaciones.service';
import {
  TRANSICIONES_HABITACION,
  esTransicionHabitacionValida,
} from '@/services/recepcion.service';

// ─── HAB-001: Crear habitación con campos obligatorios ────────────────────────

describe('HAB-001: Crear habitación válida', () => {
  it('validarHabitacion acepta datos válidos', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: 80,
      capacidad: 2,
      tipo: 'simple',
    });
    expect(result.valido).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('formatearHabitacionParaBD crea payload correcto', () => {
    const payload = formatearHabitacionParaBD({
      hotel_id: 'hotel-001',
      numero: '101',
      tipo: 'simple',
      estado: 'disponible',
      precio_noche: 80,
      capacidad: 2,
    });
    expect(payload.numero).toBe('101');
    expect(payload.estado).toBe('disponible');
    expect(payload.precio_noche).toBe(80);
    expect(payload.capacidad).toBe(2);
  });
});

// ─── HAB-002: Rechazar sin número ─────────────────────────────────────────────

describe('HAB-002: Número obligatorio', () => {
  it('rechaza habitación sin número', () => {
    const result = validarHabitacion({
      numero: '',
      precio_noche: 80,
      capacidad: 2,
      tipo: 'simple',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('número');
  });

  it('rechaza habitación con número solo espacios', () => {
    const result = validarHabitacion({
      numero: '   ',
      precio_noche: 80,
      capacidad: 2,
      tipo: 'simple',
    });
    expect(result.valido).toBe(false);
  });
});

// ─── HAB-003: Rechazar precio negativo ────────────────────────────────────────

describe('HAB-003: Precio no negativo', () => {
  it('rechaza precio negativo', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: -10,
      capacidad: 2,
      tipo: 'simple',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('precio');
  });

  it('acepta precio cero', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: 0,
      capacidad: 2,
      tipo: 'simple',
    });
    expect(result.valido).toBe(true);
  });
});

// ─── HAB-004: Rechazar capacidad < 1 ──────────────────────────────────────────

describe('HAB-004: Capacidad mínima', () => {
  it('rechaza capacidad 0', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: 80,
      capacidad: 0,
      tipo: 'simple',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('capacidad');
  });

  it('acepta capacidad 1', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: 80,
      capacidad: 1,
      tipo: 'simple',
    });
    expect(result.valido).toBe(true);
  });
});

// ─── HAB-005: Editar precio ──────────────────────────────────────────────────

describe('HAB-005: Editar precio', () => {
  it('acepta nuevo precio válido', () => {
    const result = validarHabitacion({
      numero: '101',
      precio_noche: 120,
      capacidad: 2,
      tipo: 'doble simple',
    });
    expect(result.valido).toBe(true);
  });

  it('formatearHabitacionParaBD limpia espacios del número', () => {
    const payload = formatearHabitacionParaBD({
      hotel_id: 'hotel-001',
      numero: '  101  ',
      tipo: 'simple',
      estado: 'disponible',
      precio_noche: 80,
      capacidad: 2,
    });
    expect(payload.numero).toBe('101');
  });
});

// ─── HAB-006: Transición libre → ocupada ──────────────────────────────────────

describe('HAB-006: Transición disponible → ocupada', () => {
  it('cambiarEstadoHabitacion permite libre → ocupada', () => {
    const result = cambiarEstadoHabitacion('disponible', 'check-in');
    expect(result.nuevoEstado).toBe('ocupada');
    expect(result.valido).toBe(true);
  });

  it('esTransicionHabitacionValida confirma disponible → ocupada', () => {
    expect(esTransicionHabitacionValida('disponible', 'ocupada')).toBe(true);
  });
});

// ─── HAB-007: Transición ocupada → limpieza ───────────────────────────────────

describe('HAB-007: Transición ocupada → limpieza', () => {
  it('cambiarEstadoHabitacion permite ocupada → limpieza', () => {
    const result = cambiarEstadoHabitacion('ocupada', 'check-out', true);
    expect(result.nuevoEstado).toBe('limpieza');
    expect(result.valido).toBe(true);
  });

  it('cambiarEstadoHabitacion permite ocupada → disponible (sin limpieza)', () => {
    const result = cambiarEstadoHabitacion('ocupada', 'check-out', false);
    expect(result.nuevoEstado).toBe('disponible');
    expect(result.valido).toBe(true);
  });
});

// ─── HAB-008: Transición inválida ─────────────────────────────────────────────

describe('HAB-008: Transiciones inválidas', () => {
  it('rechaza ocupada → mantenimiento', () => {
    const result = cambiarEstadoHabitacion('ocupada', 'mantenimiento');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('No se puede cambiar');
  });

  it('rechaza limpieza → ocupada directamente', () => {
    const result = cambiarEstadoHabitacion('limpieza', 'check-in');
    expect(result.valido).toBe(false);
  });

  it('rechaza mantenimiento → ocupada directamente', () => {
    const result = cambiarEstadoHabitacion('mantenimiento', 'check-in');
    expect(result.valido).toBe(false);
  });
});

// ─── HAB-009: Eliminar sin reservas activas ──────────────────────────────────

describe('HAB-009: Eliminación permitida', () => {
  it('permite eliminar cuando no hay reservas activas', () => {
    const result = puedeEliminarHabitacion(0);
    expect(result.permite).toBe(true);
    expect(result.error).toBeUndefined();
  });
});

// ─── HAB-010: Eliminar con reservas activas ──────────────────────────────────

describe('HAB-010: Eliminación protegida', () => {
  it('rechaza eliminar cuando hay 1 reserva activa', () => {
    const result = puedeEliminarHabitacion(1);
    expect(result.permite).toBe(false);
    expect(result.error).toContain('reserva');
  });

  it('rechaza eliminar cuando hay múltiples reservas activas', () => {
    const result = puedeEliminarHabitacion(5);
    expect(result.permite).toBe(false);
    expect(result.error).toContain('5');
  });
});

// ─── HAB-011: Grid agrupado por piso ──────────────────────────────────────────

describe('HAB-011: Grid agrupado por piso', () => {
  it('agrupa habitaciones por piso', () => {
    const habitaciones = [
      { id: '1', numero: '101', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2, piso: '1' },
      { id: '2', numero: '102', tipo: 'simple', estado: 'ocupada', precio_noche: 80, capacidad: 2, piso: '1' },
      { id: '3', numero: '201', tipo: 'matrimonial', estado: 'disponible', precio_noche: 120, capacidad: 2, piso: '2' },
    ];

    const mapa = agruparPorPiso(habitaciones);
    expect(mapa.size).toBe(2);
    expect(mapa.get('1').length).toBe(2);
    expect(mapa.get('2').length).toBe(1);
  });

  it('ordena habitaciones por número dentro de cada piso', () => {
    const habitaciones = [
      { id: '1', numero: '103', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2, piso: '1' },
      { id: '2', numero: '101', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2, piso: '1' },
      { id: '3', numero: '102', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2, piso: '1' },
    ];

    const mapa = agruparPorPiso(habitaciones);
    const piso1 = mapa.get('1');
    expect(piso1[0].numero).toBe('101');
    expect(piso1[1].numero).toBe('102');
    expect(piso1[2].numero).toBe('103');
  });

  it('maneja habitaciones sin piso', () => {
    const habitaciones = [
      { id: '1', numero: '101', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2 },
    ];

    const mapa = agruparPorPiso(habitaciones);
    expect(mapa.has('Sin piso')).toBe(true);
  });
});

// ─── HAB-012: Filtrado por estado ─────────────────────────────────────────────

describe('HAB-012: Filtrado por estado', () => {
  const habitaciones = [
    { id: '1', numero: '101', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2 },
    { id: '2', numero: '102', tipo: 'simple', estado: 'ocupada', precio_noche: 80, capacidad: 2 },
    { id: '3', numero: '103', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2 },
    { id: '4', numero: '201', tipo: 'matrimonial', estado: 'limpieza', precio_noche: 120, capacidad: 2 },
  ];

  it('filtra habitaciones disponibles', () => {
    const resultado = filtrarPorEstado(habitaciones, 'disponible');
    expect(resultado.length).toBe(2);
    expect(resultado.every(h => h.estado === 'disponible')).toBe(true);
  });

  it('filtra habitaciones ocupadas', () => {
    const resultado = filtrarPorEstado(habitaciones, 'ocupada');
    expect(resultado.length).toBe(1);
  });

  it('retorna todas cuando estado es null', () => {
    const resultado = filtrarPorEstado(habitaciones, null);
    expect(resultado.length).toBe(4);
  });
});

// ─── HAB-013: Estadísticas de ocupación ──────────────────────────────────────

describe('HAB-013: Estadísticas de ocupación', () => {
  it('calcula estadísticas correctamente', () => {
    const habitaciones = [
      { id: '1', numero: '101', tipo: 'simple', estado: 'disponible', precio_noche: 80, capacidad: 2 },
      { id: '2', numero: '102', tipo: 'simple', estado: 'ocupada', precio_noche: 80, capacidad: 2 },
      { id: '3', numero: '103', tipo: 'simple', estado: 'limpieza', precio_noche: 80, capacidad: 2 },
      { id: '4', numero: '201', tipo: 'matrimonial', estado: 'mantenimiento', precio_noche: 120, capacidad: 2 },
      { id: '5', numero: '202', tipo: 'matrimonial', estado: 'reservada', precio_noche: 120, capacidad: 2 },
    ];

    const stats = calcularEstadisticas(habitaciones);
    expect(stats.total).toBe(5);
    expect(stats.ocupadas).toBe(1);
    expect(stats.limpieza).toBe(1);
    expect(stats.disponibles).toBe(1);
    expect(stats.mantenimiento).toBe(1);
    expect(stats.reservadas).toBe(1);
    expect(stats.porcentajeOcupacion).toBe(40); // (1+1)/5 = 40%
  });

  it('retorna 0% cuando no hay habitaciones', () => {
    const stats = calcularEstadisticas([]);
    expect(stats.total).toBe(0);
    expect(stats.porcentajeOcupacion).toBe(0);
  });

  it('retorna 100% cuando todas están ocupadas o en limpieza', () => {
    const habitaciones = [
      { id: '1', numero: '101', tipo: 'simple', estado: 'ocupada', precio_noche: 80, capacidad: 2 },
      { id: '2', numero: '102', tipo: 'simple', estado: 'limpieza', precio_noche: 80, capacidad: 2 },
    ];
    const stats = calcularEstadisticas(habitaciones);
    expect(stats.porcentajeOcupacion).toBe(100);
  });
});

// ─── Tipos y constantes ──────────────────────────────────────────────────────

describe('Constantes de habitaciones', () => {
  it('TIPOS_HABITACION contiene todos los tipos válidos', () => {
    expect(TIPOS_HABITACION).toContain('simple');
    expect(TIPOS_HABITACION).toContain('doble simple');
    expect(TIPOS_HABITACION).toContain('matrimonial');
    expect(TIPOS_HABITACION).toContain('doble matrimonial');
    expect(TIPOS_HABITACION).toContain('mixta');
    expect(TIPOS_HABITACION).toContain('queen');
  });

  it('COLORES_ESTADO tiene entrada para cada estado', () => {
    expect(COLORES_ESTADO.disponible).toBeDefined();
    expect(COLORES_ESTADO.ocupada).toBeDefined();
    expect(COLORES_ESTADO.reservada).toBeDefined();
    expect(COLORES_ESTADO.mantenimiento).toBeDefined();
    expect(COLORES_ESTADO.limpieza).toBeDefined();
  });

  it('TRANSICIONES_HABITACION tiene entrada para cada estado', () => {
    expect(TRANSICIONES_HABITACION.disponible).toBeDefined();
    expect(TRANSICIONES_HABITACION.ocupada).toBeDefined();
    expect(TRANSICIONES_HABITACION.reservada).toBeDefined();
    expect(TRANSICIONES_HABITACION.limpieza).toBeDefined();
    expect(TRANSICIONES_HABITACION.mantenimiento).toBeDefined();
  });
});
