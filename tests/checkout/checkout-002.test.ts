// @ts-nocheck
/**
 * CHECKOUT-002: Aplicar IGV condicional
 *
 * RN-CHECKOUT-002:
 *   SI hotel.aplica_igv = true  -> base = total / 1.18, igv = total - base
 *   SI hotel.aplica_igv = false -> base = total, igv = 0
 */
import { calcularIGV } from '@/services/checkout.service';

describe('CHECKOUT-002: IGV Condicional', () => {
  it('aplica IGV 18% cuando hotel.aplica_igv = true', () => {
    const result = calcularIGV(118, true);
    expect(result.base_imponible).toBe(100);
    expect(result.igv).toBe(18);
    expect(result.total_final).toBe(118);
  });

  it('no aplica IGV cuando hotel.aplica_igv = false', () => {
    const result = calcularIGV(100, false);
    expect(result.base_imponible).toBe(100);
    expect(result.igv).toBe(0);
    expect(result.total_final).toBe(100);
  });

  it('calcula correctamente montos con decimales', () => {
    const result = calcularIGV(250.50, true);
    expect(result.base_imponible).toBeCloseTo(212.29, 2);
    expect(result.igv).toBeCloseTo(38.21, 2);
  });

  it('con monto cero, IGV es cero', () => {
    const result = calcularIGV(0, true);
    expect(result.base_imponible).toBe(0);
    expect(result.igv).toBe(0);
    expect(result.total_final).toBe(0);
  });
});
