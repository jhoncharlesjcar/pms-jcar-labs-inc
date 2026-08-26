import { describe, it, expect } from 'vitest';
import {
  validarHabitacion,
  cambiarEstadoHabitacion,
  agruparPorPiso,
  filtrarPorEstado,
  calcularEstadisticas
} from '@/services/habitaciones.service';
import type { HabitacionResumen, TipoHabitacion } from '@/services/habitaciones.service';

describe('habitaciones.service.ts', () => {
  describe('validarHabitacion', () => {
    it('valida datos correctos', () => {
      const res = validarHabitacion({ numero: '101', precio_noche: 100, capacidad: 2, tipo: 'simple' });
      expect(res.valido).toBe(true);
    });
    it('invalida numero vacio', () => {
      expect(validarHabitacion({ numero: '', precio_noche: 100, capacidad: 2, tipo: 'simple' }).valido).toBe(false);
    });
    it('invalida precio negativo', () => {
      expect(validarHabitacion({ numero: '101', precio_noche: -10, capacidad: 2, tipo: 'simple' }).valido).toBe(false);
    });
    it('invalida capacidad < 1', () => {
      expect(validarHabitacion({ numero: '101', precio_noche: 100, capacidad: 0, tipo: 'simple' }).valido).toBe(false);
    });
    it('invalida tipo', () => {
      expect(validarHabitacion({ numero: '101', precio_noche: 100, capacidad: 2, tipo: 'invalido' as any }).valido).toBe(false);
    });
  });

  describe('cambiarEstadoHabitacion', () => {
    it('transicion check-in', () => {
      const res = cambiarEstadoHabitacion('disponible', 'check-in');
      expect(res.valido).toBe(true);
      expect(res.nuevoEstado).toBe('ocupada');
    });
    it('transicion check-out sin limpieza', () => {
      const res = cambiarEstadoHabitacion('ocupada', 'check-out', false);
      expect(res.valido).toBe(true);
      expect(res.nuevoEstado).toBe('disponible');
    });
    it('transicion check-out con limpieza', () => {
      const res = cambiarEstadoHabitacion('ocupada', 'check-out', true);
      expect(res.valido).toBe(true);
      expect(res.nuevoEstado).toBe('limpieza');
    });
    it('rechaza transicion invalida', () => {
      const res = cambiarEstadoHabitacion('disponible', 'check-out');
      expect(res.valido).toBe(false);
    });
  });

  describe('agruparPorPiso', () => {
    it('agrupa y ordena por piso', () => {
      const habs: HabitacionResumen[] = [
        { id: '1', numero: '201', piso: '2', tipo: 'simple', estado: 'disponible', precio_noche: 100, capacidad: 1 },
        { id: '2', numero: '102', piso: '1', tipo: 'simple', estado: 'disponible', precio_noche: 100, capacidad: 1 },
        { id: '3', numero: '101', piso: '1', tipo: 'simple', estado: 'disponible', precio_noche: 100, capacidad: 1 },
      ];
      const res = agruparPorPiso(habs);
      expect(res.get('1')?.length).toBe(2);
      expect(res.get('1')?.[0].numero).toBe('101');
      expect(res.get('2')?.length).toBe(1);
    });
  });

  describe('calcularEstadisticas', () => {
    it('calcula estadisticas', () => {
      const habs: HabitacionResumen[] = [
        { id: '1', numero: '1', tipo: 'simple', estado: 'ocupada', precio_noche: 100, capacidad: 1 },
        { id: '2', numero: '2', tipo: 'simple', estado: 'limpieza', precio_noche: 100, capacidad: 1 },
        { id: '3', numero: '3', tipo: 'simple', estado: 'disponible', precio_noche: 100, capacidad: 1 },
        { id: '4', numero: '4', tipo: 'simple', estado: 'disponible', precio_noche: 100, capacidad: 1 },
      ];
      const res = calcularEstadisticas(habs);
      expect(res.total).toBe(4);
      expect(res.ocupadas).toBe(1);
      expect(res.limpieza).toBe(1);
      expect(res.disponibles).toBe(2);
      expect(res.porcentajeOcupacion).toBe(50); // (1 ocupada + 1 limpieza) / 4 = 50%
    });
  });
});
