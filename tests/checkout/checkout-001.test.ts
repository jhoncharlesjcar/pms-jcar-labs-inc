// @ts-nocheck
/**
 * CHECKOUT-001: Calcular total correctamente
 * 
 * Fórmula: total = (precio_noche × noches) + total_consumos - descuento
 * RN-CHECKOUT-001: El total final nunca puede ser negativo (clamped a 0)
 */
import { calcularTotal } from '@/services/checkout.service';

describe('CHECKOUT-001: Cálculo del Total a Cobrar', () => {
  it('calcula total correctamente solo con noches', () => {
    const result = calcularTotal({ precio_noche: 100, noches: 3 });
    expect(result.total_estadia).toBe(300);
    expect(result.total_consumos).toBe(0);
    expect(result.total_final).toBe(300);
  });

  it('incluye consumos extras en el total', () => {
    const result = calcularTotal({
      precio_noche: 100,
      noches: 2,
      total_consumos: 45.50,
    });
    expect(result.total_estadia).toBe(200);
    expect(result.total_consumos).toBe(45.50);
    expect(result.total_final).toBe(245.50);
  });

  it('aplica descuento correctamente', () => {
    const result = calcularTotal({
      precio_noche: 120,
      noches: 5,
      total_consumos: 30,
      descuento: 50,
    });
    expect(result.total_bruto).toBe(630);
    expect(result.descuento).toBe(50);
    expect(result.total_final).toBe(580);
  });

  it('no permite total negativo aunque descuento exceda el bruto', () => {
    const result = calcularTotal({
      precio_noche: 80,
      noches: 1,
      descuento: 200,
    });
    expect(result.total_final).toBe(0);
  });

  it('descuento default es 0', () => {
    const result = calcularTotal({ precio_noche: 90, noches: 2 });
    expect(result.descuento).toBe(0);
    expect(result.total_final).toBe(180);
  });
});
