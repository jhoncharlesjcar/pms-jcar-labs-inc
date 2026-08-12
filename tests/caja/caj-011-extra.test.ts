// @ts-nocheck
/**
 * CAJ-011 a CAJ-012: Tests adicionales para caja.service.ts
 *
 * Cubre branches y edge cases que no estaban testeados:
 *   - Fallback de método de pago desconocido
 *   - Total de egresos negativo en cierre de caja
 *
 * @see src/services/caja.service.ts
 */
import {
  calcularDesgloseMetodosPago,
  calcularDesgloseSunat,
  validarCierreCaja,
  totalizarMontos,
  totalizarVentas,
  ESTADOS_COMPROBANTE_SUNAT,
} from '@/services/caja.service';

// ─── CAJ-011: Fallback de método de pago ──────────────────────────────────

describe('CAJ-011: Fallback método de pago', () => {
  it('fallback a efectivo cuando metodo_pago es desconocido', () => {
    const metodos = calcularDesgloseMetodosPago([
      { id: 'v1', monto_pagado: 100, metodo_pago: 'bitcoin' },
      { id: 'v2', monto_pagado: 50, metodo_pago: 'cripto' },
    ]);
    expect(metodos.efectivo).toBe(150); // Ambos caen al fallback
    expect(metodos.yape).toBe(0);
    expect(metodos.plin).toBe(0);
    expect(metodos.tarjeta).toBe(0);
    expect(metodos.transferencia).toBe(0);
  });

  it('fallback no afecta métodos conocidos', () => {
    const metodos = calcularDesgloseMetodosPago([
      { id: 'v1', monto_pagado: 200, metodo_pago: 'efectivo' },
      { id: 'v2', monto_pagado: 100, metodo_pago: 'unknown_method' },
    ]);
    expect(metodos.efectivo).toBe(300); // 200 + 100 fallback
    expect(metodos.yape).toBe(0);
  });

  it('metodo_pago undefined también cae al fallback', () => {
    const metodos = calcularDesgloseMetodosPago([
      { id: 'v1', monto_pagado: 75 },
    ]);
    expect(metodos.efectivo).toBe(75);
  });
});

// ─── CAJ-011b: calcularDesgloseSunat con solo ticket_interno ──────────────

describe('CAJ-011b: Desglose SUNAT — solo ticket_interno', () => {
  it('ticket_interno no se cuenta en ningún estado SUNAT', () => {
    const sunat = calcularDesgloseSunat([
      { monto_pagado: 500, estado_comprobante: 'ticket_interno' },
    ]);
    expect(sunat.sunatDeclaradasCount).toBe(0);
    expect(sunat.sunatDeclaradasTotal).toBe(0);
    expect(sunat.sunatPendientesCount).toBe(0);
    expect(sunat.sunatPendientesTotal).toBe(0);
    expect(sunat.sunatRechazadasCount).toBe(0);
    expect(sunat.sunatRechazadasTotal).toBe(0);
  });

  it('mezcla de estados incluyendo ticket_interno', () => {
    const sunat = calcularDesgloseSunat([
      { monto_pagado: 100, estado_comprobante: 'sunat_emitido' },
      { monto_pagado: 200, estado_comprobante: 'ticket_interno' },
      { monto_pagado: 50, estado_comprobante: 'sunat_rechazado' },
    ]);
    expect(sunat.sunatDeclaradasCount).toBe(1);
    expect(sunat.sunatDeclaradasTotal).toBe(100);
    expect(sunat.sunatPendientesCount).toBe(0);
    expect(sunat.sunatPendientesTotal).toBe(0);
    expect(sunat.sunatRechazadasCount).toBe(1);
    expect(sunat.sunatRechazadasTotal).toBe(50);
  });
});

// ─── CAJ-012: Cierre de caja — egresos negativos ─────────────────────────

describe('CAJ-012: Cierre de caja — casos límite', () => {
  it('rechaza cierre con total_egresos negativo', () => {
    const result = validarCierreCaja({
      total_ventas: 500,
      total_egresos: -100,
      saldo_final: 600,
    });
    expect(result.valido).toBe(false);
    expect(result.errors.some(e => e.includes('egresos'))).toBe(true);
  });

  it('rechaza cierre con total_ventas negativo Y total_egresos negativo', () => {
    const result = validarCierreCaja({
      total_ventas: -100,
      total_egresos: -50,
      saldo_final: 0,
    });
    expect(result.valido).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── ESTADOS_COMPROBANTE_SUNAT constante ──────────────────────────────────

describe('CAJ-012b: Constante ESTADOS_COMPROBANTE_SUNAT', () => {
  it('contiene los 4 estados de comprobante', () => {
    expect(ESTADOS_COMPROBANTE_SUNAT).toContain('ticket_interno');
    expect(ESTADOS_COMPROBANTE_SUNAT).toContain('sunat_pendiente');
    expect(ESTADOS_COMPROBANTE_SUNAT).toContain('sunat_emitido');
    expect(ESTADOS_COMPROBANTE_SUNAT).toContain('sunat_rechazado');
    expect(ESTADOS_COMPROBANTE_SUNAT.length).toBe(4);
  });
});
