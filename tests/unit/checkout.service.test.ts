import { describe, it, expect } from 'vitest';
import {
  calcularTotal,
  calcularIGV,
  validarMetodoPago,
  validarReferenciaYapePlin,
  validarComprobante,
  validarPagoDuplicado
} from '@/services/checkout.service';

describe('checkout.service.ts', () => {
  describe('calcularTotal', () => {
    it('calcula el total basico', () => {
      const res = calcularTotal({ precio_noche: 100, noches: 2 });
      expect(res.total_estadia).toBe(200);
      expect(res.total_consumos).toBe(0);
      expect(res.total_final).toBe(200);
    });
    it('incluye consumos y descuentos', () => {
      const res = calcularTotal({ precio_noche: 100, noches: 2, total_consumos: 50, descuento: 20 });
      expect(res.total_estadia).toBe(200);
      expect(res.total_consumos).toBe(50);
      expect(res.total_final).toBe(230); // 200 + 50 - 20
    });
    it('nunca retorna total negativo', () => {
      const res = calcularTotal({ precio_noche: 100, noches: 1, descuento: 200 });
      expect(res.total_final).toBe(0);
    });
  });

  describe('calcularIGV', () => {
    it('calcula IGV correctamente cuando aplica', () => {
      const res = calcularIGV(118, true);
      expect(res.base_imponible).toBeCloseTo(100, 2);
      expect(res.igv).toBeCloseTo(18, 2);
      expect(res.total_final).toBe(118);
    });
    it('retorna IGV 0 cuando no aplica', () => {
      const res = calcularIGV(100, false);
      expect(res.base_imponible).toBe(100);
      expect(res.igv).toBe(0);
      expect(res.total_final).toBe(100);
    });
  });

  describe('validarMetodoPago', () => {
    it('valida metodos correctos', () => {
      expect(validarMetodoPago('efectivo').valido).toBe(true);
      expect(validarMetodoPago('tarjeta').valido).toBe(true);
    });
    it('detecta si requiere referencia', () => {
      expect(validarMetodoPago('yape').requiere_referencia).toBe(true);
      expect(validarMetodoPago('plin').requiere_referencia).toBe(true);
      expect(validarMetodoPago('efectivo').requiere_referencia).toBe(false);
    });
    it('invalida metodos incorrectos', () => {
      expect(validarMetodoPago('').valido).toBe(false);
      expect(validarMetodoPago('bitcoin').valido).toBe(false);
    });
  });

  describe('validarReferenciaYapePlin', () => {
    it('falla si requiere referencia y no hay', () => {
      expect(validarReferenciaYapePlin({ metodo: 'yape', codigoReferencia: '' }).valido).toBe(false);
    });
    it('pasa si hay referencia', () => {
      expect(validarReferenciaYapePlin({ metodo: 'yape', codigoReferencia: '123' }).valido).toBe(true);
    });
    it('pasa si metodo no requiere referencia', () => {
      expect(validarReferenciaYapePlin({ metodo: 'efectivo', codigoReferencia: '' }).valido).toBe(true);
    });
  });

  describe('validarComprobante', () => {
    it('valida factura con RUC 11', () => {
      expect(validarComprobante({ tipo: 'factura', ruc: '12345678901', razonSocial: 'Empresa' }).valido).toBe(true);
      expect(validarComprobante({ tipo: 'factura', ruc: '123', razonSocial: 'Empresa' }).valido).toBe(false);
    });
    it('valida boleta con DNI', () => {
      expect(validarComprobante({ tipo: 'boleta', dni: '12345678', nombre: 'Juan' }).valido).toBe(true);
      expect(validarComprobante({ tipo: 'boleta', dni: '', nombre: 'Juan' }).valido).toBe(false);
    });
  });

  describe('validarPagoDuplicado', () => {
    it('falla si hay pago existente', () => {
      expect(validarPagoDuplicado('1', [{ reserva_id: '1' }]).valido).toBe(false);
    });
    it('pasa si no hay', () => {
      expect(validarPagoDuplicado('1', []).valido).toBe(true);
      expect(validarPagoDuplicado('1', [{ reserva_id: '2' }]).valido).toBe(true);
    });
  });
});
