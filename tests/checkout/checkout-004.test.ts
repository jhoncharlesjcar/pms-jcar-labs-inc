// @ts-nocheck
/**
 * CHECKOUT-004: Rechazar checkout sin metodo de pago
 *
 * RN-CHECKOUT-004:
 *   SI metodo_pago vacio o no valido -> RECHAZAR transaccion
 *   Valores permitidos: ['efectivo', 'yape', 'plin', 'transferencia', 'tarjeta']
 *
 * CHECKOUT-008 (adicional):
 *   Yape/Plin requieren codigo de operacion/referencia obligatorio
 */
import { validarMetodoPago, validarReferenciaYapePlin } from '@/services/checkout.service';

describe('CHECKOUT-004: Validacion de Metodo de Pago', () => {
  it('acepta efectivo como metodo valido', () => {
    const result = validarMetodoPago('efectivo');
    expect(result.valido).toBe(true);
  });

  it('acepta yape como metodo valido', () => {
    const result = validarMetodoPago('yape');
    expect(result.valido).toBe(true);
    expect(result.requiere_referencia).toBe(true);
  });

  it('acepta plin como metodo valido', () => {
    const result = validarMetodoPago('plin');
    expect(result.valido).toBe(true);
    expect(result.requiere_referencia).toBe(true);
  });

  it('rechaza metodo vacio', () => {
    const result = validarMetodoPago('');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('método de pago');
  });

  it('rechaza metodo null', () => {
    const result = validarMetodoPago(null);
    expect(result.valido).toBe(false);
  });

  it('rechaza metodo undefined', () => {
    const result = validarMetodoPago(undefined);
    expect(result.valido).toBe(false);
  });

  it('rechaza metodo no soportado', () => {
    const result = validarMetodoPago('bitcoin');
    expect(result.valido).toBe(false);
    expect(result.error).toContain('bitcoin');
  });

  it('es case-insensitive', () => {
    const result = validarMetodoPago('TARJETA');
    expect(result.valido).toBe(true);
  });

  describe('CHECKOUT-008: Codigo de referencia para Yape/Plin', () => {
    it('requiere codigo de operacion para Yape', () => {
      const result = validarReferenciaYapePlin({ metodo: 'yape', codigoReferencia: '' });
      expect(result.valido).toBe(false);
      expect(result.error).toContain('yape');
    });

    it('acepta Yape si hay codigo de referencia', () => {
      const result = validarReferenciaYapePlin({ metodo: 'yape', codigoReferencia: 'ABC123' });
      expect(result.valido).toBe(true);
    });

    it('no requiere referencia para efectivo', () => {
      const result = validarReferenciaYapePlin({ metodo: 'efectivo', codigoReferencia: '' });
      expect(result.valido).toBe(true);
    });
  });
});
