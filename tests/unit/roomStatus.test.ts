import { describe, expect, it } from 'vitest';
import {
  canTransitionRoomStatus,
  isRoomStatus,
  roomStatusForReservationTransition,
} from '@/constants/roomStatus';

describe('room status contract', () => {
  it('rejects unknown status values', () => {
    expect(isRoomStatus('bloqueada')).toBe(false);
    expect(canTransitionRoomStatus('bloqueada', 'disponible')).toBe(false);
  });

  it.each([
    ['disponible', 'reservada', true],
    ['reservada', 'ocupada', true],
    ['ocupada', 'disponible', true],
    ['ocupada', 'limpieza', true],
    ['disponible', 'limpieza', false],
    ['ocupada', 'mantenimiento', false],
    ['mantenimiento', 'ocupada', false],
  ])('validates %s -> %s', (from, to, expected) => {
    expect(canTransitionRoomStatus(from, to)).toBe(expected);
  });

  it.each([
    ['pendiente', 'activa', 'ocupada'],
    ['activa', 'finalizada', 'limpieza'],
    ['activa', 'cancelada', 'limpieza'],
    ['pendiente', 'cancelada', 'disponible'],
    ['pendiente', 'confirmada', null],
  ])('maps reservation transition %s -> %s', (previous, next, expected) => {
    expect(roomStatusForReservationTransition(previous, next)).toBe(expected);
  });
});
