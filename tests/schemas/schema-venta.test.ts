// @ts-nocheck
/**
 * Tests de validación para los schemas Zod del dominio Ventas.
 *
 * @see src/schemas/venta.schema.ts
 * @see specs/domain-ventas.md
 */
import { ventaSchema } from '@/schemas/venta.schema';

describe('venta.schema — ventaSchema', () => {
  describe('método de pago', () => {
    it('acepta efectivo', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'efectivo' });
      expect(result.success).toBe(true);
    });

    it('acepta yape', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'yape' });
      expect(result.success).toBe(true);
    });

    it('acepta plin', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'plin' });
      expect(result.success).toBe(true);
    });

    it('acepta transferencia', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'transferencia' });
      expect(result.success).toBe(true);
    });

    it('acepta tarjeta', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'tarjeta' });
      expect(result.success).toBe(true);
    });

    it('rechaza método de pago inválido', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'bitcoin' });
      expect(result.success).toBe(false);
    });

    it('rechaza método de pago vacío', () => {
      const result = ventaSchema.safeParse({ metodo_pago: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('descuento', () => {
    it('acepta descuento cero por defecto', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'efectivo' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.descuento).toBe(0);
      }
    });

    it('acepta descuento positivo', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'efectivo', descuento: 50 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.descuento).toBe(50);
      }
    });

    it('rechaza descuento negativo', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'efectivo', descuento: -10 });
      expect(result.success).toBe(false);
    });
  });

  describe('comprobante — valores por defecto', () => {
    it('no requiere comprobante por defecto', () => {
      const result = ventaSchema.safeParse({ metodo_pago: 'efectivo' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requiere_comprobante).toBe(false);
        expect(result.data.tipo_comprobante).toBe('ninguno');
      }
    });

    it('acepta boleta como tipo de comprobante', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'efectivo',
        tipo_comprobante: 'boleta',
      });
      expect(result.success).toBe(true);
    });

    it('acepta factura como tipo de comprobante', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'efectivo',
        tipo_comprobante: 'factura',
      });
      expect(result.success).toBe(true);
    });

    it('rechaza tipo de comprobante inválido', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'efectivo',
        tipo_comprobante: 'comprobante_invalido',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('factura — validación condicional (superRefine)', () => {
    it('rechaza factura sin RUC', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'tarjeta',
        requiere_comprobante: true,
        tipo_comprobante: 'factura',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.path.includes('ruc_cliente'))).toBe(true);
    });

    it('rechaza factura con RUC inválido (menos de 11 dígitos)', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'tarjeta',
        requiere_comprobante: true,
        tipo_comprobante: 'factura',
        ruc_cliente: '12345678',
        razon_social: 'Empresa SAC',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues[0].message).toContain('11 dígitos');
    });

    it('rechaza factura sin razón social', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'tarjeta',
        requiere_comprobante: true,
        tipo_comprobante: 'factura',
        ruc_cliente: '20123456789',
      });
      expect(result.success).toBe(false);
      expect(result.error.issues.some(i => i.path.includes('razon_social'))).toBe(true);
    });

    it('acepta factura con RUC y razón social correctos', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'tarjeta',
        requiere_comprobante: true,
        tipo_comprobante: 'factura',
        ruc_cliente: '20123456789',
        razon_social: 'Empresa de Prueba SAC',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('boleta — sin validación condicional extra', () => {
    it('acepta boleta sin datos adicionales', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'efectivo',
        requiere_comprobante: true,
        tipo_comprobante: 'boleta',
      });
      // La validación condicional en ventaSchema solo aplica para facturas
      expect(result.success).toBe(true);
    });
  });

  describe('ninguno — sin comprobante', () => {
    it('acepta tipo ninguno sin datos del cliente', () => {
      const result = ventaSchema.safeParse({
        metodo_pago: 'efectivo',
        requiere_comprobante: false,
        tipo_comprobante: 'ninguno',
      });
      expect(result.success).toBe(true);
    });
  });
});
