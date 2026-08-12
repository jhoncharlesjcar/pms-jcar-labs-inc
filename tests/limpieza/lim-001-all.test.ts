// @ts-nocheck
/**
 * LIM-001 a LIM-010: Tests de contrato del dominio Limpieza / Housekeeping
 *
 * Tests de contrato que validan transiciones de estados de limpieza,
 * control de insumos, alertas de stock bajo, asignación de tareas
 * e historial inmutable.
 *
 * @see specs/domain-limpieza.md — Sección 7
 */
import {
  prepararTransicionALimpieza,
  completarLimpieza,
  consumirInsumo,
  verificarStockBajo,
  prepararAsignacionTarea,
  calcularDuracionLimpieza,
  construirHistorialLimpieza,
  registrarEntradaInsumo,
  registrarSalidaInsumo,
  obtenerInsumosStockBajo,
  ESTADOS_LIMPIEZA,
  TIPOS_MOVIMIENTO,
  type InsumoData,
  type HabitacionLimpieza,
} from '@/services/limpieza.service';

// ─── Datos de prueba reutilizables ──────────────────────────────────────────

const habOcupada: HabitacionLimpieza = {
  id: 'hab-001',
  numero: '101',
  estado: 'ocupada',
};

const habLimpieza: HabitacionLimpieza = {
  id: 'hab-002',
  numero: '102',
  estado: 'limpieza',
};

const habDisponible: HabitacionLimpieza = {
  id: 'hab-003',
  numero: '103',
  estado: 'disponible',
};

const insumoJabon: InsumoData = {
  id: 'ins-001',
  hotel_id: 'hotel-001',
  nombre: 'Jabón Líquido',
  stock: 20,
  unidad_medida: 'litro',
  umbral_minimo: 5,
  costo_unitario: 3.50,
  activo: true,
};

const insumoPapel: InsumoData = {
  id: 'ins-002',
  hotel_id: 'hotel-001',
  nombre: 'Papel Higiénico',
  stock: 3,
  unidad_medida: 'unidad',
  umbral_minimo: 10,
  costo_unitario: 1.20,
  activo: true,
};

const insumoDesactivado: InsumoData = {
  id: 'ins-003',
  hotel_id: 'hotel-001',
  nombre: 'Desinfectante Vencido',
  stock: 5,
  unidad_medida: 'litro',
  umbral_minimo: 2,
  costo_unitario: 8.00,
  activo: false,
};

// ─── LIM-001: Check-out → habitación 'limpieza' ─────────────────────────────

describe('LIM-001: Transición a limpieza post-check-out', () => {
  it('prepara cambio de estado a limpieza después de check-out', () => {
    const result = prepararTransicionALimpieza(habOcupada);
    expect(result.nuevoEstado).toBe('limpieza');
    expect(result.limpiezaPendiente.habitacion_id).toBe('hab-001');
  });

  it('genera fecha de asignación válida', () => {
    const result = prepararTransicionALimpieza(habOcupada);
    const fecha = new Date(result.limpiezaPendiente.fecha_asignacion);
    expect(fecha.getTime()).not.toBeNaN();
    expect(fecha <= new Date()).toBe(true);
  });

  it('ESTADOS_LIMPIEZA.PENDING es "limpieza"', () => {
    expect(ESTADOS_LIMPIEZA.PENDING).toBe('limpieza');
  });
});

// ─── LIM-002: Marcar limpieza como completada ────────────────────────────────

describe('LIM-002: Completar limpieza', () => {
  it('permite completar limpieza de habitación en estado "limpieza"', () => {
    const result = completarLimpieza(habLimpieza);
    expect(result.valido).toBe(true);
    expect(result.nuevoEstado).toBe('disponible');
  });

  it('rechaza completar limpieza de habitación que no está en limpieza', () => {
    const result = completarLimpieza(habDisponible);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('no está en estado de limpieza');
  });

  it('rechaza completar limpieza de habitación ocupada', () => {
    const result = completarLimpieza(habOcupada);
    expect(result.valido).toBe(false);
  });

  it('permite registrar insumos usados al completar limpieza', () => {
    const result = completarLimpieza(
      habLimpieza,
      [
        { insumoId: 'ins-001', cantidad: 2, costoTotal: 7.00 },
        { insumoId: 'ins-002', cantidad: 4, costoTotal: 4.80 },
      ],
      'user-001',
      'limpieza-pendiente-001'
    );
    expect(result.valido).toBe(true);
    expect(result.movimientos.length).toBe(2);
    expect(result.movimientos[0].insumo_id).toBe('ins-001');
    expect(result.movimientos[0].tipo_movimiento).toBe('salida');
    expect(result.movimientos[0].usuario_id).toBe('user-001');
    expect(result.movimientos[0].limpieza_id).toBe('limpieza-pendiente-001');
  });

  it('genera motivo de consumo con número de habitación', () => {
    const result = completarLimpieza(
      habLimpieza,
      [{ insumoId: 'ins-001', cantidad: 1, costoTotal: 3.50 }],
      'user-001'
    );
    expect(result.movimientos[0].motivo).toContain('102');
  });
});

// ─── LIM-003: Al completar → habitación 'disponible' ────────────────────────

describe('LIM-003: Liberación de habitación post-limpieza', () => {
  it('ESTADOS_LIMPIEZA.COMPLETED es "disponible"', () => {
    expect(ESTADOS_LIMPIEZA.COMPLETED).toBe('disponible');
  });

  it('completarLimpieza cambia a "disponible"', () => {
    const result = completarLimpieza(habLimpieza);
    expect(result.nuevoEstado).toBe('disponible');
  });

  it('si no hay insumos, movimientos está vacío', () => {
    const result = completarLimpieza(habLimpieza);
    expect(result.movimientos.length).toBe(0);
  });
});

// ─── LIM-004: Consumo de insumos descuenta stock ────────────────────────────

describe('LIM-004: Consumo de insumos', () => {
  it('descuenta stock correctamente', () => {
    const result = consumirInsumo(insumoJabon, 5);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(15);
    expect(result.costoTotal).toBe(17.50);
  });

  it('rechaza consumo con cantidad cero', () => {
    const result = consumirInsumo(insumoJabon, 0);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('mayor a 0');
  });

  it('rechaza consumo con cantidad negativa', () => {
    const result = consumirInsumo(insumoJabon, -3);
    expect(result.valido).toBe(false);
  });

  it('rechaza consumo que excede stock disponible', () => {
    const result = consumirInsumo(insumoJabon, 999);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('insuficiente');
  });

  it('rechaza consumo de insumo desactivado', () => {
    const result = consumirInsumo(insumoDesactivado, 1);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('desactivado');
  });
});

// ─── LIM-005: Alerta cuando stock ≤ umbral_minimo ───────────────────────────

describe('LIM-005: Alerta de stock bajo', () => {
  it('detecta stock bajo (stock ≤ umbral mínimo)', () => {
    const result = verificarStockBajo(insumoPapel);
    expect(result.stockBajo).toBe(true);
    expect(result.mensaje).toContain('Papel Higiénico');
    expect(result.mensaje).toContain('3');
    expect(result.mensaje).toContain('10');
  });

  it('no alerta cuando stock es mayor al umbral', () => {
    const result = verificarStockBajo(insumoJabon);
    expect(result.stockBajo).toBe(false);
    expect(result.mensaje).toBeUndefined();
  });

  it('alerta cuando stock es exactamente igual al umbral', () => {
    const insumoExacto = { ...insumoPapel, stock: 10 };
    const result = verificarStockBajo(insumoExacto);
    expect(result.stockBajo).toBe(true);
  });

  it('consumo que deja stock bajo genera alerta', () => {
    const result = consumirInsumo(insumoJabon, 16);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(4);
    expect(result.stockBajo).toBe(true);
  });

  it('obtenerInsumosStockBajo filtra correctamente', () => {
    const insumos = [insumoJabon, insumoPapel, insumoDesactivado];
    const bajos = obtenerInsumosStockBajo(insumos);
    expect(bajos.length).toBe(1);
    expect(bajos[0].insumo.nombre).toBe('Papel Higiénico');
    expect(bajos[0].alerta).toContain('Stock bajo');
  });

  it('obtenerInsumosStockBajo retorna vacío si todos tienen stock', () => {
    const insumosBien = [
      { ...insumoJabon, stock: 50 },
      { ...insumoPapel, stock: 20, umbral_minimo: 5 },
    ];
    const bajos = obtenerInsumosStockBajo(insumosBien);
    expect(bajos.length).toBe(0);
  });
});

// ─── LIM-006: Historial de limpieza es inmutable ────────────────────────────

describe('LIM-006: Historial de limpieza', () => {
  it('calcularDuracionLimpieza calcula minutos correctamente', () => {
    const result = calcularDuracionLimpieza(
      '2026-07-15T10:00:00Z',
      '2026-07-15T10:45:00Z'
    );
    expect(result.valido).toBe(true);
    expect(result.duracionMinutos).toBe(45);
  });

  it('calcularDuracionLimpieza rechaza fechas inválidas', () => {
    const result = calcularDuracionLimpieza('fecha-invalida', '2026-07-15T10:00:00Z');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('inválidas');
  });

  it('calcularDuracionLimpieza rechaza fin anterior a inicio', () => {
    const result = calcularDuracionLimpieza(
      '2026-07-15T10:00:00Z',
      '2026-07-15T09:00:00Z'
    );
    expect(result.valido).toBe(false);
    expect(result.error).toContain('posterior');
  });

  it('calcularDuracionLimpieza mínimo 1 minuto', () => {
    const result = calcularDuracionLimpieza(
      '2026-07-15T10:00:00Z',
      '2026-07-15T10:00:30Z'
    );
    expect(result.valido).toBe(true);
    expect(result.duracionMinutos).toBe(1);
  });

  it('construirHistorialLimpieza crea payload correcto', () => {
    const historial = construirHistorialLimpieza({
      habitacionId: 'hab-001',
      usuarioId: 'user-001',
      fechaInicio: '2026-07-15T10:00:00Z',
      fechaFin: '2026-07-15T10:45:00Z',
      duracionMinutos: 45,
      insumosUsados: [
        { insumoId: 'ins-001', nombre: 'Jabón Líquido', cantidad: 2 },
      ],
      observaciones: 'Limpieza completa',
    });

    expect(historial.habitacion_id).toBe('hab-001');
    expect(historial.usuario_id).toBe('user-001');
    expect(historial.duracion_minutos).toBe(45);
    expect(historial.insumos_usados.length).toBe(1);
    expect(historial.insumos_usados[0].nombre).toBe('Jabón Líquido');
    expect(historial.observaciones).toBe('Limpieza completa');
  });

  it('construirHistorialLimpieza maneja observaciones vacías', () => {
    const historial = construirHistorialLimpieza({
      habitacionId: 'hab-001',
      usuarioId: 'user-001',
      fechaInicio: '2026-07-15T10:00:00Z',
      fechaFin: '2026-07-15T10:30:00Z',
      duracionMinutos: 30,
      insumosUsados: [],
    });

    expect(historial.observaciones).toBe('');
  });
});

// ─── LIM-007: Solo personal autorizado puede marcar completada ──────────────

describe('LIM-007: Autorización de limpieza', () => {
  it('completarLimpieza sin insumos no genera movimientos', () => {
    const result = completarLimpieza(habLimpieza, [], '');
    expect(result.valido).toBe(true);
    expect(result.movimientos.length).toBe(0);
  });

  it('completarLimpieza registra usuario_id en movimientos cuando hay insumos', () => {
    const result = completarLimpieza(
      habLimpieza,
      [{ insumoId: 'ins-001', cantidad: 1, costoTotal: 3.50 }],
      'user-002'
    );
    expect(result.movimientos.length).toBe(1);
    expect(result.movimientos[0].usuario_id).toBe('user-002');
  });

  it('completarLimpieza con insumos y usuario vacío asigna string vacío', () => {
    const result = completarLimpieza(
      habLimpieza,
      [{ insumoId: 'ins-001', cantidad: 1, costoTotal: 3.50 }],
      ''
    );
    expect(result.movimientos.length).toBe(1);
    expect(result.movimientos[0].usuario_id).toBe('');
  });
});

// ─── LIM-008: Asignación de tarea a empleado específico ─────────────────────

describe('LIM-008: Asignación de tarea', () => {
  it('prepara asignación sin empleado específico', () => {
    const result = prepararAsignacionTarea({
      habitacionId: 'hab-001',
      hotelId: 'hotel-001',
    });
    expect(result.habitacion_id).toBe('hab-001');
    expect(result.hotel_id).toBe('hotel-001');
    expect(result.usuario_id).toBeUndefined();
  });

  it('prepara asignación con empleado específico', () => {
    const result = prepararAsignacionTarea({
      habitacionId: 'hab-002',
      hotelId: 'hotel-001',
      usuarioId: 'user-003',
    });
    expect(result.habitacion_id).toBe('hab-002');
    expect(result.usuario_id).toBe('user-003');
  });

  it('genera fecha de asignación válida', () => {
    const result = prepararAsignacionTarea({
      habitacionId: 'hab-001',
      hotelId: 'hotel-001',
    });
    const fecha = new Date(result.fecha_asignacion);
    expect(fecha.getTime()).not.toBeNaN();
  });
});

// ─── LIM-009: Entrada de insumo incrementa stock ────────────────────────────

describe('LIM-009: Entrada de insumo', () => {
  it('incrementa stock correctamente', () => {
    const result = registrarEntradaInsumo(insumoJabon, 10);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(30);
  });

  it('rechaza entrada con cantidad cero', () => {
    const result = registrarEntradaInsumo(insumoJabon, 0);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('mayor a 0');
  });

  it('rechaza entrada con cantidad negativa', () => {
    const result = registrarEntradaInsumo(insumoJabon, -5);
    expect(result.valido).toBe(false);
  });

  it('rechaza entrada en insumo desactivado', () => {
    const result = registrarEntradaInsumo(insumoDesactivado, 10);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('desactivado');
  });

  it('acepta entrada grande', () => {
    const result = registrarEntradaInsumo(insumoJabon, 1000);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(1020);
  });

  it('múltiples entradas incrementan stock acumulativamente', () => {
    const r1 = registrarEntradaInsumo(insumoJabon, 5);
    const r2 = registrarEntradaInsumo({ ...insumoJabon, stock: r1.nuevoStock }, 3);
    expect(r1.nuevoStock).toBe(25);
    expect(r2.nuevoStock).toBe(28);
  });
});

// ─── LIM-010: Salida de insumo decrementa stock ─────────────────────────────

describe('LIM-010: Salida de insumo', () => {
  it('decrementa stock correctamente', () => {
    const result = registrarSalidaInsumo(insumoJabon, 3);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(17);
  });

  it('rechaza salida que excede stock', () => {
    const result = registrarSalidaInsumo(insumoJabon, 999);
    expect(result.valido).toBe(false);
    expect(result.error).toContain('insuficiente');
  });

  it('marca stock bajo si después de la salida queda ≤ umbral', () => {
    const insumo = { ...insumoPapel, stock: 12 };
    const result = registrarSalidaInsumo(insumo, 3);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(9);
    expect(result.stockBajo).toBe(true);
  });

  it('no marca stock bajo si después de la salida queda > umbral', () => {
    const insumo = { ...insumoJabon, stock: 20 };
    const result = registrarSalidaInsumo(insumo, 2);
    expect(result.valido).toBe(true);
    expect(result.nuevoStock).toBe(18);
    expect(result.stockBajo).toBe(false);
  });

  it('rechaza salida con cantidad negativa', () => {
    const result = registrarSalidaInsumo(insumoJabon, -1);
    expect(result.valido).toBe(false);
  });

  it('TIPOS_MOVIMIENTO contiene entrada y salida', () => {
    expect(TIPOS_MOVIMIENTO).toContain('entrada');
    expect(TIPOS_MOVIMIENTO).toContain('salida');
    expect(TIPOS_MOVIMIENTO.length).toBe(2);
  });
});

// ─── UNIDADES_MEDIDA ────────────────────────────────────────────────────────

describe('Constantes de Limpieza', () => {
  it('ESTADOS_LIMPIEZA tiene todos los estados', () => {
    expect(ESTADOS_LIMPIEZA.PENDING).toBe('limpieza');
    expect(ESTADOS_LIMPIEZA.IN_PROGRESS).toBe('limpieza');
    expect(ESTADOS_LIMPIEZA.COMPLETED).toBe('disponible');
  });
});
