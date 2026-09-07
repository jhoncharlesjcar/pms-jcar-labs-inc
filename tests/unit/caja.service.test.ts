import { describe, it, expect } from 'vitest';
import {
  calcularBalanceEfectivo,
  evaluarArqueoEfectivo,
  calcularDesgloseMetodosPago,
  calcularDesgloseSunat,
  calcularCajaStats,
  validarEgreso,
  prepararCierreCaja,
  validarCierreCaja,
  totalizarVentas,
  totalizarMontos
} from '@/services/caja.service';

describe('caja.service.ts', () => {
  const ventasMock = [
    { total: 100, metodo_pago: 'efectivo', estado_comprobante: 'sunat_emitido' },
    { total: 50, metodo_pago: 'yape', estado_comprobante: 'sunat_pendiente' },
    { total: 200, metodo_pago: 'efectivo', estado_comprobante: 'ticket_interno' },
    { total: 150, metodo_pago: 'tarjeta', estado_comprobante: 'sunat_rechazado' },
  ] as any[];

  const egresosMock = [
    { monto: 20 },
    { monto: 30 }
  ] as any[];

  describe('calcularBalanceEfectivo', () => {
    it('suma ventas en efectivo y resta egresos', () => {
      // efectivo total = 100 + 200 = 300
      // egresos total = 50
      // balance = 250
      expect(calcularBalanceEfectivo(300, 50)).toBe(250);
    });
  });

  describe('evaluarArqueoEfectivo', () => {
    it('retorna sin_conteo si no hay valor', () => {
      expect(evaluarArqueoEfectivo(100, null).estado).toBe('sin_conteo');
    });
    it('retorna cuadrado si es igual', () => {
      expect(evaluarArqueoEfectivo(100, 100).estado).toBe('cuadrado');
    });
    it('retorna faltante si es menor', () => {
      expect(evaluarArqueoEfectivo(100, 90).estado).toBe('faltante');
      expect(evaluarArqueoEfectivo(100, 90).diferencia).toBe(-10);
    });
    it('retorna sobrante si es mayor', () => {
      expect(evaluarArqueoEfectivo(100, 110).estado).toBe('sobrante');
      expect(evaluarArqueoEfectivo(100, 110).diferencia).toBe(10);
    });
  });

  describe('calcularDesgloseMetodosPago', () => {
    it('desglosa por metodo', () => {
      const res = calcularDesgloseMetodosPago(ventasMock);
      expect(res.efectivo).toBe(300);
      expect(res.yape).toBe(50);
      expect(res.tarjeta).toBe(150);
      expect(res.plin).toBe(0);
    });
  });

  describe('calcularDesgloseSunat', () => {
    it('desglosa por estado', () => {
      const res = calcularDesgloseSunat(ventasMock);
      expect(res.sunatDeclaradasCount).toBe(1);
      expect(res.sunatPendientesCount).toBe(1);
      expect(res.sunatRechazadasCount).toBe(1);
    });
  });

  describe('calcularCajaStats', () => {
    it('calcula estadisticas completas combinando hotel, POS y egresos', () => {
      const vHotel = [{ total: 120, metodo_pago: 'efectivo', estado_comprobante: 'sunat_emitido' }];
      const vPOS = [{ total: 30, metodo_pago: 'yape', estado_comprobante: 'ticket_interno' }];
      const egresos = [{ monto: 25 }];

      const stats = calcularCajaStats(vHotel as any, vPOS as any, egresos as any);
      expect(stats.ingresos).toBe(150);
      expect(stats.hotel).toBe(120);
      expect(stats.pos).toBe(30);
      expect(stats.egresos).toBe(25);
      expect(stats.balance).toBe(125);
      expect(stats.balanceEfectivo).toBe(95); // 120 efectivo - 25 egresos
      expect(stats.countHotel).toBe(1);
      expect(stats.countPOS).toBe(1);
      expect(stats.countEgresos).toBe(1);
      expect(stats.metodos.efectivo).toBe(120);
      expect(stats.metodos.yape).toBe(30);
    });
  });

  describe('validarEgreso', () => {
    it('valida monto mayor a 0', () => {
      expect(validarEgreso({ monto: 0, concepto: 'abc', categoria: 'otros' }).valido).toBe(false);
      expect(validarEgreso({ monto: -5, concepto: 'abc', categoria: 'otros' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'otros' }).valido).toBe(true);
    });
    it('invalida concepto menor a 3 caracteres o vacio', () => {
      expect(validarEgreso({ monto: 10, concepto: 'ab', categoria: 'otros' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: '   ', categoria: 'otros' }).valido).toBe(false);
    });
    it('invalida categoria desconocida', () => {
      expect(validarEgreso({ monto: 10, concepto: 'compra', categoria: 'desconocida' as any }).valido).toBe(false);
    });
    it('valida insumo requiere id y cantidad', () => {
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos', insumo_id: '   ' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos', insumo_id: '1', cantidad_insumo: 0 }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos', insumo_id: '1', cantidad_insumo: 2 }).valido).toBe(true);
    });
  });

  describe('prepararCierreCaja', () => {
    it('prepara payload redondeado con notas limpias', () => {
      const stats = { ingresos: 250.555, egresos: 50.111, balance: 200.444 } as any;
      const res = prepararCierreCaja(stats, '  Turno Mañana  ');
      expect(res.total_ventas).toBe(250.56);
      expect(res.total_egresos).toBe(50.11);
      expect(res.saldo_final).toBe(200.44);
      expect(res.notas).toBe('Turno Mañana');
    });
  });

  describe('validarCierreCaja', () => {
    it('falla si hay saldo inconsistente', () => {
      expect(validarCierreCaja({ total_ventas: 100, total_egresos: 30, saldo_final: 100 }).valido).toBe(false);
      expect(validarCierreCaja({ total_ventas: 100, total_egresos: 30, saldo_final: 70 }).valido).toBe(true);
    });
    it('rechaza total_ventas negativo', () => {
      const res = validarCierreCaja({ total_ventas: -10, total_egresos: 10, saldo_final: -20 });
      expect(res.valido).toBe(false);
      expect(res.errors).toContain('El total de ventas no puede ser negativo');
    });
    it('rechaza total_egresos negativo', () => {
      const res = validarCierreCaja({ total_ventas: 100, total_egresos: -10, saldo_final: 110 });
      expect(res.valido).toBe(false);
      expect(res.errors).toContain('El total de egresos no puede ser negativo');
    });
  });

  describe('totalizarMontos y totalizarVentas', () => {
    it('suma montos de egresos', () => {
      expect(totalizarMontos([{ monto: 10.5 }, { monto: 20.25 }, { monto: 0 }])).toBe(30.75);
      expect(totalizarMontos([])).toBe(0);
    });
    it('suma totales de ventas respetando monto_pagado o total', () => {
      expect(totalizarVentas([{ monto_pagado: 50.2 }, { total: 40.3 } as any])).toBe(90.5);
      expect(totalizarVentas([])).toBe(0);
    });
  });
});
