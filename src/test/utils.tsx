import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, act } from 'react'
import { vi } from 'vitest'

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null })
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', email: 'test@example.com' } }, error: null })
  },
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'test/path.jpg' }, error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://example.com/signed' }, error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }
})

// Mock context providers
const createWrapper = (_mockSupabase: ReturnType<typeof createMockSupabase>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'admin',
  hotel_id: 'test-hotel-id',
  ...overrides
})

export const createMockHotel = (overrides = {}) => ({
  id: 'test-hotel-id',
  nombre: 'Hotel Test',
  activo: true,
  ...overrides
})

export const createMockDb = (mockSupabase: ReturnType<typeof createMockSupabase>) => ({
  from: mockSupabase.from,
  rpc: mockSupabase.rpc,
  forHotel: (hotelId: string) => ({
    from: mockSupabase.from,
    rpc: mockSupabase.rpc
  })
})

export { createMockSupabase, createWrapper }

// Hook testing helpers
export async function waitForHookResult<T>(
  hookResult: { current: T | undefined },
  predicate: (value: T) => boolean,
  timeout = 5000
): Promise<T> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (hookResult.current && predicate(hookResult.current)) {
      return hookResult.current
    }
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error('Timeout waiting for hook result')
}

export function actAsync(callback: () => Promise<void>) {
  return act(async () => {
    await callback()
  })
}