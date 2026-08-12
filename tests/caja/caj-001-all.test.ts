// @ts-nocheck
/**
 * CAJ-001 a CAJ-010: Tests de contrato del dominio Caja
 *
 * Tests de contrato que validan cálculos de estadísticas de caja,
 * desglose por método de pago, balance de efectivo, desglose SUNAT,
 * registro de egresos con validación condicional, y cierre de caja.
 *
 * @see src/services/caja.service.ts
 * @see src/schemas/caja.schema.ts
 */
import {
  calcularCajaStats,
  calcularDesgloseMetodosPago,
  calcularBalanceEfectivo,
  calcularDesgloseSunat,
  validarEgreso,
  prepararCierreCaja,
  validarCierreCaja,
  totalizarMontos,
  totalizarVentas,
  filtrarPorFecha,
  filtrarPorPeriodo,
  METODOS_PAGO,
  CATEGORIAS_EGRESO,
} from '@/services/caja.service';

// ─── Datos de prueba ──────────────────────────────────────────────────────

const hoy = new Date();
const hoyStr = hoy.toISOString();

const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);
const ayerStr = ayer.toISOString();

const ventasHotelHoy = [
  { id: 'vh1', monto_pagado: 200, metodo_pago: 'efectivo', estado_comprobante: 'sunat_emitido', created_date: hoyStr },
  { id: 'vh2', monto_pagado: 150, metodo_pago: 'yape', estado_comprobante: 'sunat_pendiente', created_date: hoyStr },
  { id: 'vh3', monto_pagado: 300, metodo_pago: 'tarjeta', estado_comprobante: 'ticket_interno', created_date: hoyStr },
];

const ventasPosHoy = [
  { id: 'vp1', total: 45.50, metodo_pago: 'efectivo', estado_comprobante: 'sunat_emitido', created_date: hoyStr },
  { id: 'vp2', total: 32.00, metodo_pago: 'plin', estado_comprobante: 'sunat_rechazado', created_date: hoyStr },
];

const egresosHoy = [
  { id: 'eg1', monto: 50, concepto: 'Compra jabón', categoria: 'insumos', created_date: hoyStr },
  { id: 'eg2', monto: 120, concepto: 'Pago luz', categoria: 'servicios', created_date: hoyStr },
];

const ventasHotelAyer = [
  { id: 'vh4', monto_pagado: 500, metodo_pago: 'transferencia', estado_comprobante: 'sunat_emitido', created_date: ayerStr },
];

// ─── CAJ-001: Calcular estadísticas del día ────────────────────────────────

describe('CAJ-001: Calcular estadísticas de caja', () => {
  it('calcula totales correctamente para el día', () => {
    const stats = calcularCajaStats(ventasHotelHoy, ventasPosHoy, egresosHoy);

    expect(stats.hotel).toBe(650);          // 200 + 150 + 300
    expect(stats.pos).toBe(77.50);          // 45.50 + 32.00
    expect(stats.ingresos).toBe(727.50);    // 650 + 77.50
    expect(stats.egresos).toBe(170);        // 50 + 120
    expect(stats.balance).toBe(557.50);     // 727.50 - 170
    expect(stats.countHotel).toBe(3);
    expect(stats.countPOS).toBe(2);
    expect(stats.countEgresos).toBe(2);
  });

  it('retorna ceros cuando no hay datos', () => {
    const stats = calcularCajaStats([], [], []);
    expect(stats.hotel).toBe(0);
    expect(stats.pos).toBe(0);
    expect(stats.ingresos).toBe(0);
    expect(stats.egresos).toBe(0);
    expect(stats.balance).toBe(0);
    expect(stats.countHotel).toBe(0);
    expect(stats.countPOS).toBe(0);
    expect(stats.countEgresos).toBe(0);
  });

  it('maneja ventas sin monto (undefined)', () => {
    const stats = calcularCajaStats(
      [{ id: 'v1', metodo_pago: 'efectivo', created_date: hoyStr }],
      [],
      []
    );
    expect(stats.hotel).toBe(0);
    expect(stats.countHotel).toBe(1);
  });

  it('totalizarVentas suma correctamente', () => {
    expect(totalizarVentas(ventasHotelHoy)).toBe(650);
    expect(totalizarVentas(ventasPosHoy)).toBe(77.50);
    expect(totalizarVentas([])).toBe(0);
  });

  it('totalizarMontos suma correctamente', () => {
    expect(totalizarMontos(egresosHoy)).toBe(170);
    expect(totalizarMontos([])).toBe(0);
  });
});

// ─── CAJ-002: Desglose por método de pago ──────────────────────────────────

describe('CAJ-002: Desglose por método de pago', () => {
  it('desglosa correctamente todos los métodos', () => {
    const metodos = calcularDesgloseMetodosPago([...ventasHotelHoy, ...ventasPosHoy]);

    expect(metodos.efectivo).toBe(245.50);   // 200 (vh1) + 45.50 (vp1)
    expect(metodos.yape).toBe(150);           // 150 (vh2)
    expect(metodos.plin).toBe(32);            // 32 (vp2)
    expect(metodos.tarjeta).toBe(300);        // 300 (vh3)
    expect(metodos.transferencia).toBe(0);
  });

  it('retorna ceros para todos los métodos cuando no hay ventas', () => {
    const metodos = calcularDesgloseMetodosPago([]);
    expect(metodos.efectivo).toBe(0);
    expect(metodos.yape).toBe(0);
    expect(metodos.plin).toBe(0);
    expect(metodos.tarjeta).toBe(0);
    expect(metodos.transferencia).toBe(0);
  });

  it('es case-insensitive para método de pago', () => {
    const metodos = calcularDesgloseMetodosPago([
      { id: 'v1', monto_pagado: 100, metodo_pago: 'YAPE', created_date: hoyStr },
      { id: 'v2', monto_pagado: 50, metodo_pago: 'EFECTIVO', created_date: hoyStr },
    ]);
    expect(metodos.yape).toBe(100);
    expect(metodos.efectivo).toBe(50);
  });

  it('METODOS_PAGO contiene los 5 métodos soportados', () => {
    expect(METODOS_PAGO).toContain('efectivo');
    expect(METODOS_PAGO).toContain('yape');
    expect(METODOS_PAGO).toContain('plin');
    expect(METODOS_PAGO).toContain('transferencia');
    expect(METODOS_PAGO).toContain('tarjeta');
    expect(METODOS_PAGO.length).toBe(5);
  });
});

// ─── CAJ-003: Balance de efectivo ──────────────────────────────────────────

describe('CAJ-003: Balance de efectivo', () => {
  it('calcula balanceEfectivo correctamente', () => {
    const stats = calcularCajaStats(ventasHotelHoy, ventasPosHoy, egresosHoy);
    // efectivo = 200 (vh1) + 45.50 (vp1) = 245.50
    // egresos = 170
    // balanceEfectivo = 245.50 - 170 = 75.50
    expect(stats.balanceEfectivo).toBe(75.50);
  });

  it('calcula balanceEfectivo cero si no hay efectivo ni egresos', () => {
    const stats = calcularCajaStats([], [], []);
    expect(stats.balanceEfectivo).toBe(0);
  });

  it('calcula balanceEfectivo negativo si egresos > efectivo', () => {
    const stats = calcularCajaStats(
      [{ id: 'v1', monto_pagado: 100, metodo_pago: 'efectivo', created_date: hoyStr }],
      [],
      [{ id: 'e1', monto: 200, concepto: 'Gasto', categoria: 'operativo', created_date: hoyStr }]
    );
    expect(stats.balanceEfectivo).toBe(-100);
  });

  it('calcularBalanceEfectivo como función pura', () => {
    expect(calcularBalanceEfectivo(500, 200)).toBe(300);
    expect(calcularBalanceEfectivo(100, 0)).toBe(100);
    expect(calcularBalanceEfectivo(0, 100)).toBe(-100);
    expect(calcularBalanceEfectivo(0, 0)).toBe(0);
  });
});

// ─── CAJ-004: Desglose SUNAT ──────────────────────────────────────────────

describe('CAJ-004: Desglose SUNAT', () => {
  it('clasifica correctamente los estados de comprobante', () => {
    const stats = calcularCajaStats(ventasHotelHoy, ventasPosHoy, egresosHoy);

    // sunat_emitido: vh1 (200) + vp1 (45.50) = 245.50, count 2
    // sunat_pendiente: vh2 (150), count 1
    // sunat_rechazado: vp2 (32), count 1
    // ticket_interno: vh3 (300), no cuenta

    expect(stats.sunatDeclaradasCount).toBe(2);
    expect(stats.sunatDeclaradasTotal).toBe(245.50);
    expect(stats.sunatPendientesCount).toBe(1);
    expect(stats.sunatPendientesTotal).toBe(150);
    expect(stats.sunatRechazadasCount).toBe(1);
    expect(stats.sunatRechazadasTotal).toBe(32);
  });

  it('calcularDesgloseSunat como función pura', () => {
    const ventas = [
      { monto_pagado: 100, estado_comprobante: 'sunat_emitido' },
      { monto_pagado: 200, estado_comprobante: 'sunat_pendiente' },
      { monto_pagado: 50, estado_comprobante: 'sunat_rechazado' },
      { monto_pagado: 75, estado_comprobante: 'ticket_interno' },
    ];

    const sunat = calcularDesgloseSunat(ventas);
    expect(sunat.sunatDeclaradasCount).toBe(1);
    expect(sunat.sunatDeclaradasTotal).toBe(100);
    expect(sunat.sunatPendientesCount).toBe(1);
    expect(sunat.sunatPendientesTotal).toBe(200);
    expect(sunat.sunatRechazadasCount).toBe(1);
    expect(sunat.sunatRechazadasTotal).toBe(50);
  });

  it('retorna ceros si no hay ventas SUNAT', () => {
    const sunat = calcularDesgloseSunat([]);
    expect(sunat.sunatDeclaradasCount).toBe(0);
    expect(sunat.sunatDeclaradasTotal).toBe(0);
    expect(sunat.sunatPendientesCount).toBe(0);
    expect(sunat.sunatPendientesTotal).toBe(0);
    expect(sunat.sunatRechazadasCount).toBe(0);
    expect(sunat.sunatRechazadasTotal).toBe(0);
  });
});

// ─── CAJ-005: Filtrado por período ────────────────────────────────────────

describe('CAJ-005: Filtrado por período', () => {
  it('filtrarPorFecha retorna solo registros de hoy', () => {
    const filtrados = filtrarPorFecha([...ventasHotelHoy, ...ventasHotelAyer], hoy, 'created_date');
    expect(filtrados.length).toBe(3);
    expect(filtrados.every(v => v.created_date === hoyStr)).toBe(true);
  });

  it('filtrarPorFecha evalúa múltiples campos de fecha en orden', () => {
    const registros = [
      { id: 'v1', monto_pagado: 100, fecha_pago: hoyStr },
      { id: 'v2', monto_pagado: 200, fecha_venta: hoyStr },
    ];
    const filtrados = filtrarPorFecha(registros, hoy, 'fecha_pago', 'fecha_venta');
    expect(filtrados.length).toBe(2);
  });

  it('filtrarPorPeriodo "hoy" retorna solo registros de hoy', () => {
    const todos = [...ventasHotelHoy, ...ventasHotelAyer];
    const hoyRegistros = filtrarPorPeriodo(todos, 'hoy', 'created_date');
    expect(hoyRegistros.length).toBe(3);
  });

  it('filtrarPorPeriodo "todo" retorna todos los registros', () => {
    const todos = [...ventasHotelHoy, ...ventasHotelAyer];
    const todoRegistros = filtrarPorPeriodo(todos, 'todo');
    expect(todoRegistros.length).toBe(4);
  });

  it('filtrarPorPeriodo retorna vacío si no hay registros', () => {
    expect(filtrarPorPeriodo([], 'hoy').length).toBe(0);
    expect(filtrarPorPeriodo([], 'semana').length).toBe(0);
    expect(filtrarPorPeriodo([], 'todo').length).toBe(0);
  });
});

// ─── CAJ-006: Registrar egreso válido ──────────────────────────────────────

describe('CAJ-006: Registrar egreso válido', () => {
  it('acepta egreso operativo con todos los campos', () => {
    const result = validarEgreso({
      monto: 150,
      concepto: 'Compra de insumos',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('acepta egreso con monto decimal', () => {
    const result = validarEgreso({
      monto: 99.99,
      concepto: 'Gasto menor operativo',
      categoria: 'servicios',
    });
    expect(result.valido).toBe(true);
  });

  it('CATEGORIAS_EGRESO contiene todas las categorías', () => {
    expect(CATEGORIAS_EGRESO).toContain('operativo');
    expect(CATEGORIAS_EGRESO).toContain('servicios');
    expect(CATEGORIAS_EGRESO).toContain('insumos');
    expect(CATEGORIAS_EGRESO).toContain('mantenimiento');
    expect(CATEGORIAS_EGRESO).toContain('personal');
    expect(CATEGORIAS_EGRESO).toContain('otros');
    expect(CATEGORIAS_EGRESO.length).toBe(6);
  });
});

// ─── CAJ-007: Rechazar egreso con monto inválido ───────────────────────────

describe('CAJ-007: Rechazar egreso con monto inválido', () => {
  it('rechaza monto cero', () => {
    const result = validarEgreso({
      monto: 0,
      concepto: 'Gasto prueba',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('monto');
  });

  it('rechaza monto negativo', () => {
    const result = validarEgreso({
      monto: -50,
      concepto: 'Gasto prueba',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('monto');
  });

  it('rechaza monto undefined', () => {
    const result = validarEgreso({
      monto: undefined,
      concepto: 'Gasto prueba',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(false);
  });
});

// ─── CAJ-008: Rechazar egreso con concepto inválido ────────────────────────

describe('CAJ-008: Rechazar egreso con concepto inválido', () => {
  it('rechaza concepto vacío', () => {
    const result = validarEgreso({
      monto: 100,
      concepto: '',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('concepto');
  });

  it('rechaza concepto con menos de 3 caracteres', () => {
    const result = validarEgreso({
      monto: 100,
      concepto: 'AB',
      categoria: 'operativo',
    });
    expect(result.valido).toBe(false);
  });

  it('rechaza categoría inválida', () => {
    const result = validarEgreso({
      monto: 100,
      concepto: 'Gasto prueba',
      categoria: 'inversión',
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('categoría');
  });
});

// ─── CAJ-009: Registrar egreso de insumos ──────────────────────────────────

describe('CAJ-009: Registrar egreso de insumos', () => {
  it('acepta egreso de insumos con insumo_id y cantidad', () => {
    const result = validarEgreso({
      monto: 200,
      concepto: 'Compra jabón líquido',
      categoria: 'insumos',
      insumo_id: 'ins-001',
      cantidad_insumo: 20,
    });
    expect(result.valido).toBe(true);
  });

  it('rechaza egreso de insumos sin insumo_id', () => {
    const result = validarEgreso({
      monto: 200,
      concepto: 'Compra jabón',
      categoria: 'insumos',
      insumo_id: '',
      cantidad_insumo: 10,
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('insumo');
  });

  it('rechaza egreso de insumos sin cantidad_insumo', () => {
    const result = validarEgreso({
      monto: 200,
      concepto: 'Compra jabón',
      categoria: 'insumos',
      insumo_id: 'ins-001',
      cantidad_insumo: undefined,
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('cantidad');
  });

  it('rechaza egreso de insumos con cantidad_insumo cero', () => {
    const result = validarEgreso({
      monto: 200,
      concepto: 'Compra jabón',
      categoria: 'insumos',
      insumo_id: 'ins-001',
      cantidad_insumo: 0,
    });
    expect(result.valido).toBe(false);
  });

  it('acumula múltiples errores de validación', () => {
    const result = validarEgreso({
      monto: 0,
      concepto: '',
      categoria: 'insumos',
      insumo_id: '',
      cantidad_insumo: 0,
    });
    expect(result.valido).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── CAJ-010: Cierre de caja ──────────────────────────────────────────────

describe('CAJ-010: Cierre de caja', () => {
  it('prepara payload de cierre correctamente', () => {
    const cierre = prepararCierreCaja({
      ingresos: 727.50,
      egresos: 170,
      balance: 557.50,
    }, 'Sin novedades');

    expect(cierre.total_ventas).toBe(727.50);
    expect(cierre.total_egresos).toBe(170);
    expect(cierre.saldo_final).toBe(557.50);
    expect(cierre.notas).toBe('Sin novedades');
  });

  it('prepara cierre sin notas', () => {
    const cierre = prepararCierreCaja({
      ingresos: 500,
      egresos: 200,
      balance: 300,
    });
    expect(cierre.notas).toBe('');
    expect(cierre.saldo_final).toBe(300);
  });

  it('prepara cierre con decimales', () => {
    const cierre = prepararCierreCaja({
      ingresos: 123.45,
      egresos: 67.89,
      balance: 55.56,
    });
    expect(cierre.saldo_final).toBe(55.56);
  });

  it('validarCierreCaja acepta cierre consistente', () => {
    const result = validarCierreCaja({
      total_ventas: 727.50,
      total_egresos: 170,
      saldo_final: 557.50,
    });
    expect(result.valido).toBe(true);
  });

  it('validarCierreCaja rechaza saldo inconsistente', () => {
    const result = validarCierreCaja({
      total_ventas: 500,
      total_egresos: 200,
      saldo_final: 500, // Debería ser 300
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('saldo');
  });

  it('validarCierreCaja rechaza total_ventas negativo', () => {
    const result = validarCierreCaja({
      total_ventas: -100,
      total_egresos: 0,
      saldo_final: 0,
    });
    expect(result.valido).toBe(false);
    expect(result.errors[0]).toContain('ventas');
  });

  it('validarCierreCaja acepta todos en cero', () => {
    const result = validarCierreCaja({
      total_ventas: 0,
      total_egresos: 0,
      saldo_final: 0,
    });
    expect(result.valido).toBe(true);
  });
});
