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

  describe('validarEgreso', () => {
    it('valida monto mayor a 0', () => {
      expect(validarEgreso({ monto: 0, concepto: 'abc', categoria: 'otros' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'otros' }).valido).toBe(true);
    });
    it('valida insumo requiere id', () => {
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos' }).valido).toBe(false);
      expect(validarEgreso({ monto: 10, concepto: 'abc', categoria: 'insumos', insumo_id: '1', cantidad_insumo: 2 }).valido).toBe(true);
    });
  });

  describe('validarCierreCaja', () => {
    it('falla si hay saldo inconsistente', () => {
      expect(validarCierreCaja({ total_ventas: 100, total_egresos: 30, saldo_final: 100 }).valido).toBe(false);
      expect(validarCierreCaja({ total_ventas: 100, total_egresos: 30, saldo_final: 70 }).valido).toBe(true);
    });
  });
});
