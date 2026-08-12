import { describe, it, expect } from 'vitest';
import {
  calculateEarnedPoints,
  isSimpleRoomType,
  canRedeemSimpleDiscount,
  calculateSimpleRoomDiscount,
  POINTS_PER_NIGHT,
  REDEMPTION_COST_POINTS,
} from '../loyalty.service';

describe('Loyalty Service Domain Unit Tests', () => {
  it('debe calcular 10 puntos por cada noche de estadía (Regla 1)', () => {
    expect(calculateEarnedPoints(1)).toBe(10);
    expect(calculateEarnedPoints(3)).toBe(30);
    expect(calculateEarnedPoints(0)).toBe(0);
  });

  it('debe identificar correctamente si una habitación es de tipo simple', () => {
    expect(isSimpleRoomType('Habitación Simple')).toBe(true);
    expect(isSimpleRoomType('sencilla')).toBe(true);
    expect(isSimpleRoomType('Individual')).toBe(true);
    expect(isSimpleRoomType('Matrimonial')).toBe(false);
    expect(isSimpleRoomType('Doble Suite')).toBe(false);
  });

  it('debe validar que la redención requiera mínimo 100 puntos y habitación simple (Regla 2)', () => {
    expect(canRedeemSimpleDiscount(100, 'Habitación Simple')).toBe(true);
    expect(canRedeemSimpleDiscount(250, 'Simple')).toBe(true);
    expect(canRedeemSimpleDiscount(90, 'Simple')).toBe(false);
    expect(canRedeemSimpleDiscount(150, 'Matrimonial')).toBe(false);
  });

  it('debe calcular 50% de descuento sobre el precio de la habitación simple (Regla 2)', () => {
    // 80 soles/noche por 1 noche = 80 -> 50% desc = 40 soles
    expect(calculateSimpleRoomDiscount(80, 1)).toBe(40);
    // 100 soles/noche por 2 noches = 200 -> 50% desc (1 bloque) = 100 soles
    expect(calculateSimpleRoomDiscount(100, 2, 1)).toBe(100);
  });
});
