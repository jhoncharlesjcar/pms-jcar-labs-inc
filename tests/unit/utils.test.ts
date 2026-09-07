import { describe, expect, it, vi } from 'vitest';
import { cn, generateUUID } from '@/lib/utils';

describe('shared utilities', () => {
  it('merges Tailwind classes deterministically', () => {
    expect(cn('px-2', false && 'hidden', 'px-4')).toBe('px-4');
  });

  it('returns a RFC 4122 v4 identifier', () => {
    expect(generateUUID()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('uses the cryptographic byte fallback when randomUUID is unavailable', () => {
    const originalCrypto = globalThis.crypto;
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.fill(1);
      return bytes;
    });
    Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues }, configurable: true });

    expect(generateUUID()).toBe('01010101-0101-4101-8101-010101010101');
    expect(getRandomValues).toHaveBeenCalledOnce();
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });

  it('throws when crypto is undefined', () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    expect(() => generateUUID()).toThrow('No hay un generador criptografico disponible');
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  });
});
