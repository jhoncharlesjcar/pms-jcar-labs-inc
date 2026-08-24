import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
  keys: vi.fn(async () => [...store.keys()]),
}));

beforeAll(() => {
  const eventTarget = new EventTarget();
  Object.defineProperty(globalThis, 'window', { value: eventTarget, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      key: vi.fn(),
      clear: vi.fn(),
      length: 0,
    },
    configurable: true,
  });
});

beforeEach(() => store.clear());

describe('controles de privacidad offline', () => {
  it('solo permite persistir consultas explícitamente no sensibles y exitosas', async () => {
    const { shouldPersistQuery } = await import('../../src/lib/query-client.js');
    expect(shouldPersistQuery({ queryKey: ['productos'], state: { status: 'success' } })).toBe(true);
    expect(shouldPersistQuery({ queryKey: ['reservas'], state: { status: 'success' } })).toBe(false);
    expect(shouldPersistQuery({ queryKey: ['productos'], state: { status: 'pending' } })).toBe(false);
  });

  it('rechaza mutaciones genéricas offline sin persistir su carga', async () => {
    const { enqueueMutation } = await import('../../src/lib/sync-queue.js');
    await expect(enqueueMutation({ huesped_dni: '12345678' })).rejects.toThrow(/requiere conexión/i);
    expect(store.size).toBe(0);
  });

  it('purga colas heredadas y separadas por identidad', async () => {
    store.set('offline_queue_user_hotel', [{ id: 1 }]);
    store.set('dead_letter_queue', [{ id: 2 }]);
    store.set('safe-cache-entry', { id: 3 });
    const { purgeAllQueues } = await import('../../src/lib/sync-queue.js');
    await purgeAllQueues();
    expect(store.has('offline_queue_user_hotel')).toBe(false);
    expect(store.has('dead_letter_queue')).toBe(false);
    expect(store.has('safe-cache-entry')).toBe(true);
  });
});
