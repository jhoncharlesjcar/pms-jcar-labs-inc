import { describe, it, expect } from 'vitest';
import {
  POINTS_PER_NIGHT,
  REDEMPTION_COST_POINTS,
  REDEMPTION_DISCOUNT_PERCENT,
  calculateEarnedPoints,
  isSimpleRoomType,
  canRedeemSimpleDiscount,
  calculateSimpleRoomDiscount,
} from '@/services/loyalty.service';

describe('loyalty.service.ts (funciones puras de dominio)', () => {
  it('expone las constantes de dominio correctas', () => {
    expect(POINTS_PER_NIGHT).toBe(10);
    expect(REDEMPTION_COST_POINTS).toBe(100);
    expect(REDEMPTION_DISCOUNT_PERCENT).toBe(0.5);
  });

  describe('calculateEarnedPoints', () => {
    it('calcula 10 puntos por noche', () => {
      expect(calculateEarnedPoints(0)).toBe(0);
      expect(calculateEarnedPoints(3)).toBe(30);
    });

    it('redondea hacia abajo y nunca devuelve negativos', () => {
      expect(calculateEarnedPoints(2.9)).toBe(20);
      expect(calculateEarnedPoints(-5)).toBe(0);
    });
  });

  describe('isSimpleRoomType', () => {
    it('detecta tipos de habitación simple', () => {
      expect(isSimpleRoomType('Simple')).toBe(true);
      expect(isSimpleRoomType('sencilla')).toBe(true);
      expect(isSimpleRoomType('individual')).toBe(true);
    });

    it('rechaza otros tipos y valores vacíos', () => {
      expect(isSimpleRoomType('doble')).toBe(false);
      expect(isSimpleRoomType(undefined)).toBe(false);
    });
  });

  describe('canRedeemSimpleDiscount', () => {
    it('requiere saldo suficiente y habitación simple', () => {
      expect(canRedeemSimpleDiscount(100, 'simple')).toBe(true);
      expect(canRedeemSimpleDiscount(99, 'simple')).toBe(false);
      expect(canRedeemSimpleDiscount(100, 'doble')).toBe(false);
      expect(canRedeemSimpleDiscount(100, undefined)).toBe(false);
    });
  });

  describe('calculateSimpleRoomDiscount', () => {
    it('aplica 50% sobre el costo de la noche', () => {
      expect(calculateSimpleRoomDiscount(100, 1)).toBe(50);
      expect(calculateSimpleRoomDiscount(100, 2)).toBe(100);
    });

    it('multiplica por bloques redimidos', () => {
      expect(calculateSimpleRoomDiscount(100, 1, 2)).toBe(100);
    });

    it('retorna 0 para precio cero', () => {
      expect(calculateSimpleRoomDiscount(0, 5)).toBe(0);
    });
  });
});
