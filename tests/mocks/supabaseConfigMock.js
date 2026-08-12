/**
 * Mock para src/config/supabase.ts
 *
 * Reemplaza el módulo que usa import.meta.env (Vite-specific) con un mock
 * que Jest puede procesar en CommonJS. Las variables de entorno se leen
 * de process.env con fallbacks para tests.
 *
 * @see https://jestjs.io/docs/configuration#modulenamemapper-object
 */

// Variables de entorno para tests (fallbacks seguros)
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://test.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'test-anon-key';

// Cliente Supabase mockeado
export const supabase = {
  auth: {
    getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signOut: jest.fn(() => Promise.resolve({ error: null })),
    signUp: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  },
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockResolvedValue({}),
    unsubscribe: jest.fn(),
  })),
  functions: {
    invoke: jest.fn(() => Promise.resolve({ data: null, error: null })),
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn(),
      download: jest.fn(),
      getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
    })),
  },
};
