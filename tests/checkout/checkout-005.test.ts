// @ts-nocheck
/**
 * CHECKOUT-005: Validar RUC si tipo_comprobante = 'factura'
 * CHECKOUT-006: Validar DNI 8 digitos si boleta
 * CHECKOUT-007: Validar DNI exactamente 8 dígitos numéricos para boleta
 *
 * RN-CHECKOUT-005:
 *   factura -> ruc obligatorio, regex /^\d{11}$/
 *   factura -> razon_social obligatorio, min 3 caracteres
 *   boleta  -> dni obligatorio, exactamente 8 dígitos numéricos
 *   boleta  -> nombre obligatorio, min 3 caracteres
 */
import { validarComprobante } from '@/services/checkout.service';

describe('CHECKOUT-005: Validacion de Comprobante SUNAT', () => {
  describe('Factura', () => {
    it('rechaza factura sin RUC', () => {
      const result = validarComprobante({
        tipo: 'factura',
        ruc: '',
        razonSocial: 'Empresa SAC',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('RUC');
    });

    it('rechaza RUC con menos de 11 digitos', () => {
      const result = validarComprobante({
        tipo: 'factura',
        ruc: '12345678',
        razonSocial: 'Empresa SAC',
      });
      expect(result.valido).toBe(false);
    });

    it('rechaza RUC con letras', () => {
      const result = validarComprobante({
        tipo: 'factura',
        ruc: '20ABCDEFGHI',
        razonSocial: 'Empresa SAC',
      });
      expect(result.valido).toBe(false);
    });

    it('rechaza factura sin razon social', () => {
      const result = validarComprobante({
        tipo: 'factura',
        ruc: '20123456789',
        razonSocial: '',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('razón social');
    });

    it('acepta factura con RUC y razon social validos', () => {
      const result = validarComprobante({
        tipo: 'factura',
        ruc: '20123456789',
        razonSocial: 'Hoteles Peruanos SAC',
      });
      expect(result.valido).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Boleta', () => {
    it('rechaza boleta sin DNI', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '',
        nombre: 'Juan Perez',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('8 dígitos');
    });

    it('rechaza boleta sin nombre', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '12345678',
        nombre: '',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('nombre');
    });

    it('acepta boleta con DNI 8 dígitos y nombre válido', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '12345678',
        nombre: 'Juan Perez',
      });
      expect(result.valido).toBe(true);
    });

    it('rechaza DNI con menos de 8 dígitos', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '1234567',
        nombre: 'Juan Perez',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('8 dígitos');
    });

    it('rechaza DNI con letras', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '1234567A',
        nombre: 'Juan Perez',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('8 dígitos');
    });

    it('rechaza DNI con más de 8 dígitos', () => {
      const result = validarComprobante({
        tipo: 'boleta',
        dni: '123456789',
        nombre: 'Juan Perez',
      });
      expect(result.valido).toBe(false);
      expect(result.errors[0]).toContain('8 dígitos');
    });
  });

  describe('Sin comprobante', () => {
    it('no requiere validacion si no hay comprobante', () => {
      const result = validarComprobante({
        tipo: 'ninguno',
      });
      expect(result.valido).toBe(true);
    });
  });
});
