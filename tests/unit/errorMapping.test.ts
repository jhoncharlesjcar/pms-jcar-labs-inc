import { describe, expect, it } from 'vitest';
import { formatErrorMessage } from '@/utils/errorMapping';

describe('formatErrorMessage', () => {
  it('uses a safe fallback for empty errors', () => {
    expect(formatErrorMessage(null)).toContain('error inesperado');
  });

  it.each([
    [{ code: '42501' }, 'permisos'],
    [{ code: '23505' }, 'Ya existe'],
    [{ code: '23503' }, 'registro asociado'],
    [{ message: 'Invalid login credentials' }, 'contraseña incorrectos'],
    [{ message: 'Failed to fetch' }, 'conexión a la red'],
  ])('maps operational errors without exposing internals', (error, expected) => {
    expect(formatErrorMessage(error)).toContain(expected);
  });

  it('preserves an already-safe business message', () => {
    expect(formatErrorMessage({ message: 'La reserva ya fue confirmada' })).toBe('La reserva ya fue confirmada');
  });
});
