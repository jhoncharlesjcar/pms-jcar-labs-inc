// @ts-nocheck
/**
 * AUTH-001 a AUTH-017: Tests de contrato para el servicio de Autenticación
 *
 * Valida las funciones de auth.service.ts, auth.store.ts y guards.tsx:
 *   - getSession, loadUserProfile, createDemoProfile, registerAuditLog
 *   - useAuthStore (setSession, setUser, setHotelId, isAuthenticated, clearAuth)
 *   - AuthGuard y RoleGuard
 *
 * @see src/services/auth.service.ts
 * @see src/store/auth.store.ts
 * @see src/router/guards.tsx
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

import { AuthService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';
import { AuthGuard, RoleGuard } from '@/router/guards';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetSession = jest.fn();
const mockGetUser = jest.fn();

/**
 * Crea mock de la cadena supabase.from('usuarios').select('*').eq('id', id).single()
 */
function createProfileChain(resolvedValue) {
  const mockSingle = jest.fn().mockResolvedValue(resolvedValue);
  const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
  const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

  jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(mockFrom);

  return { mockFrom, mockSelect, mockEq, mockSingle };
}

jest.mock('@/config/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      getUser: (...args) => mockGetUser(...args),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(() => ({})),
  },
}));

// jest.mock se hoistea → NO usar JSX en el factory, usar React.createElement
jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  const React = require('react');
  return {
    ...actual,
    Navigate: jest.fn(({ to }) =>
      React.createElement('div', { 'data-testid': 'navigate', 'data-to': to })
    ),
    useLocation: jest.fn(() => ({ pathname: '/test', search: '', hash: '', state: null })),
  };
});

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const DEFAULT_HOTEL_ID = '11111111-1111-1111-1111-111111111111';

const mockAdminProfile = {
  id: 'user-admin-123', email: 'admin@hotel.com',
  full_name: 'Admin Principal', role: 'admin', hotel_id: 'hotel-001',
  created_date: '2026-01-01T00:00:00Z',
};

const mockRecepcionistaProfile = {
  id: 'user-rec-456', email: 'recepcion@hotel.com',
  full_name: 'Recepcionista Juan', role: 'recepcionista', hotel_id: 'hotel-001',
};

const mockDeveloperProfile = {
  id: 'user-dev-789', email: 'dev@hotel.com',
  full_name: 'Developer Carmen', role: 'developer', hotel_id: 'hotel-001',
};

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-001: getSession — Obtener sesión activa
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-001: Obtener sesión activa', () => {
  it('retorna la sesión cuando el usuario está autenticado', async () => {
    const mockSession = { user: { id: 'user-123', email: 'test@hotel.com' } };
    mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
    expect(await AuthService.getSession()).toEqual(mockSession);
  });

  it('lanza error cuando hay un error de sesión', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('No session') });
    await expect(AuthService.getSession()).rejects.toThrow('No session');
  });

  it('retorna null cuando no hay sesión activa sin error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
    expect(await AuthService.getSession()).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-002: loadUserProfile — Cargar perfil de usuario existente
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-002: Cargar perfil de usuario existente', () => {
  it('retorna perfil con role admin', async () => {
    createProfileChain({ data: mockAdminProfile, error: null });
    const profile = await AuthService.loadUserProfile('user-admin-123');
    expect(profile.role).toBe('admin');
    expect(profile.full_name).toBe('Admin Principal');
  });

  it('retorna perfil con role recepcionista', async () => {
    createProfileChain({ data: mockRecepcionistaProfile, error: null });
    expect((await AuthService.loadUserProfile('user-rec-456')).role).toBe('recepcionista');
  });

  it('retorna perfil con role developer', async () => {
    createProfileChain({ data: mockDeveloperProfile, error: null });
    expect((await AuthService.loadUserProfile('user-dev-789')).role).toBe('developer');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-003: loadUserProfile — Perfil inexistente crea demo
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-003: Perfil inexistente → crea demo automáticamente', () => {
  it('llama a createDemoProfile cuando el perfil no existe (PGRST116)', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-new', email: 'nuevo@hotel.com', user_metadata: {} } },
    });

    // Mock unificado: soporta tanto select (loadUserProfile) como insert (createDemoProfile)
    let callCount = 0;
    const insertSingleMock = jest.fn().mockResolvedValue({
      data: { id: 'user-new', email: 'nuevo@hotel.com', full_name: 'nuevo',
              role: 'admin', hotel_id: DEFAULT_HOTEL_ID },
      error: null,
    });

    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({
        // Primera llamada: loadUserProfile busca perfil existente
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found', details: '', hint: '' }
            })
          })
        }),
        // Segunda llamada: createDemoProfile inserta nuevo perfil
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({ single: insertSingleMock })
        }),
      })
    );

    const profile = await AuthService.loadUserProfile('user-new');
    expect(profile.role).toBe('admin');
  });

  it('lanza error si falla con error diferente a PGRST116', async () => {
    const errSingle = jest.fn().mockResolvedValue({ data: null, error: new Error('DB error') });
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ single: errSingle })
        })
      })
    );
    await expect(AuthService.loadUserProfile('user-xxx')).rejects.toThrow('DB error');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-004: createDemoProfile — role admin (email normal)
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-004: Crear perfil demo para usuario normal → role admin', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-demo', email: 'demo@hotel.com', user_metadata: { full_name: 'Demo' } } },
    });
  });

  it('crea perfil con role admin', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'user-demo', email: 'demo@hotel.com', full_name: 'Demo',
              role: 'admin', hotel_id: DEFAULT_HOTEL_ID },
      error: null,
    });
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({ insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) }) })
    );
    const profile = await AuthService.createDemoProfile('user-demo');
    expect(profile.role).toBe('admin');
    expect(profile.hotel_id).toBe(DEFAULT_HOTEL_ID);
  });

  it('lanza error si no hay usuario de autenticación', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(AuthService.createDemoProfile('user-demo')).rejects.toThrow(
      'Usuario de autenticación no disponible'
    );
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-005: createDemoProfile — role developer (email dueño)
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-005: Crear perfil demo con email de developer', () => {
  it('asigna role developer para email del dueño', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-owner', email: 'almanacenromeroj@gmail.com', user_metadata: {} } },
    });
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'user-owner', email: 'almanacenromeroj@gmail.com',
              full_name: 'almanacenromeroj', role: 'developer', hotel_id: DEFAULT_HOTEL_ID },
      error: null,
    });
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({ insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: mockSingle }) }) })
    );
    expect((await AuthService.createDemoProfile('user-owner')).role).toBe('developer');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-006: Normalizar role 'administrador' → 'admin'
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-006: Normalizar administrador a admin', () => {
  it('corrige role "administrador" a "admin" y actualiza en BD', async () => {
    const malformed = { id: 'user-mal', email: 'admin@hotel.com', full_name: 'Admin',
                        role: 'administrador', hotel_id: 'hotel-001' };
    const mockSingle = jest.fn().mockResolvedValue({ data: malformed, error: null });
    const mockEqUpdate = jest.fn().mockResolvedValue({ data: null, error: null });

    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) }),
        update: jest.fn().mockReturnValue({ eq: mockEqUpdate }),
      })
    );

    expect((await AuthService.loadUserProfile('user-mal')).role).toBe('admin');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-007: Forzar role developer para email del dueño
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-007: Forzar developer para email almanacenromeroj@gmail.com', () => {
  it('fuerza role developer aunque el perfil tenga role admin', async () => {
    const ownerProfile = { id: 'user-owner', email: 'almanacenromeroj@gmail.com',
                           full_name: 'Dueño', role: 'admin', hotel_id: 'hotel-001' };
    const mockSingle = jest.fn().mockResolvedValue({ data: ownerProfile, error: null });
    const mockEqUpdate = jest.fn().mockResolvedValue({ data: null, error: null });

    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      () => ({
        select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: mockSingle }) }),
        update: jest.fn().mockReturnValue({ eq: mockEqUpdate }),
      })
    );

    expect((await AuthService.loadUserProfile('user-owner')).role).toBe('developer');
  });

  it('no fuerza si el dueño ya tiene role developer', async () => {
    const ownerProfile = { id: 'user-owner-dev', email: 'almanacenromeroj@gmail.com',
                           full_name: 'Dev Dueño', role: 'developer', hotel_id: 'hotel-001' };
    createProfileChain({ data: ownerProfile, error: null });
    expect((await AuthService.loadUserProfile('user-owner-dev')).role).toBe('developer');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-008: registerAuditLog — Registro exitoso
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-008: Registrar audit log exitosamente', () => {
  function mockAuditInsert() {
    let insertedData = null;
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      (table) => table === 'audit_logs'
        ? { insert: (data) => { insertedData = data; return { select: jest.fn() }; } }
        : {}
    );
    return () => insertedData;
  }

  it('registra log con todos los campos', async () => {
    const getInserted = mockAuditInsert();
    await AuthService.registerAuditLog({
      hotel_id: 'hotel-001', usuario_id: 'user-123', usuario_nombre: 'Admin',
      usuario_role: 'admin', accion: 'CHECK-IN',
      descripcion: 'Check-in: Hab. 101 - Juan Perez', modulo: 'recepcion',
    });
    const data = getInserted();
    expect(data.accion).toBe('CHECK-IN');
    expect(data.modulo).toBe('recepcion');
    expect(data.hotel_id).toBe('hotel-001');
    expect(data.created_date).toBeTruthy();
  });

  it('registra log con módulo pos', async () => {
    const getInserted = mockAuditInsert();
    await AuthService.registerAuditLog({
      hotel_id: 'hotel-001', usuario_id: 'user-456', usuario_nombre: 'Vendedor',
      usuario_role: 'recepcionista', accion: 'VENTA-POS',
      descripcion: 'Venta POS #POS123 - S/ 45.00', modulo: 'pos',
    });
    expect(getInserted().modulo).toBe('pos');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-009: registerAuditLog — Fallback a localStorage
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-009: Fallback a localStorage cuando Supabase falla', () => {
  function throwNetworkError() { throw new Error('Network error'); }

  it('almacena en localStorage si Supabase no está disponible', async () => {
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(throwNetworkError);
    await AuthService.registerAuditLog({
      hotel_id: 'hotel-001', usuario_id: 'user-123', usuario_nombre: 'Test',
      usuario_role: 'admin', accion: 'TEST', descripcion: 'Test fallback', modulo: 'dev',
    });
    const fallback = JSON.parse(localStorage.getItem('audit_logs_fallback') || '[]');
    expect(fallback.length).toBe(1);
    expect(fallback[0].accion).toBe('TEST');
  });

  it('mantiene máximo 100 registros', async () => {
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(throwNetworkError);
    for (let i = 0; i < 110; i++) {
      await AuthService.registerAuditLog({
        hotel_id: 'hotel-001', usuario_id: 'user-123', usuario_nombre: 'Test',
        usuario_role: 'admin', accion: `LOG-${i}`, descripcion: `Log ${i}`, modulo: 'dev',
      });
    }
    const fallback = JSON.parse(localStorage.getItem('audit_logs_fallback') || '[]');
    expect(fallback.length).toBe(100);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-010: registerAuditLog — Conversión a mayúsculas
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-010: Conversión de accion a mayúsculas', () => {
  function captureAuditInsert() {
    let inserted = null;
    jest.spyOn(require('@/config/supabase').supabase, 'from').mockImplementation(
      (table) => table === 'audit_logs'
        ? { insert: (data) => { inserted = data; return { select: jest.fn() }; } }
        : {}
    );
    return () => inserted;
  }

  it('convierte accion en minúsculas a mayúsculas', async () => {
    const getData = captureAuditInsert();
    await AuthService.registerAuditLog({
      hotel_id: 'hotel-001', usuario_id: 'user-123', usuario_nombre: 'Test',
      usuario_role: 'admin', accion: 'check-in', descripcion: 'Test', modulo: 'recepcion',
    });
    expect(getData().accion).toBe('CHECK-IN');
  });

  it('mantiene accion ya en mayúsculas', async () => {
    const getData = captureAuditInsert();
    await AuthService.registerAuditLog({
      hotel_id: 'hotel-001', usuario_id: 'user-123', usuario_nombre: 'Test',
      usuario_role: 'recepcionista', accion: 'CHECK-OUT', descripcion: 'Test', modulo: 'recepcion',
    });
    expect(getData().accion).toBe('CHECK-OUT');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-011: AuthGuard — Redirección a /login si no hay sesión
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-011: AuthGuard redirige a /login si no hay sesión', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, isAuthenticated: false });
  });

  it('redirige a /login cuando no hay sesión activa', () => {
    render(
      <MemoryRouter initialEntries={['/recepcion']}>
        <AuthGuard>
          <div data-testid="guarded">Contenido protegido</div>
        </AuthGuard>
      </MemoryRouter>
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByTestId('guarded')).toBeNull();
  });

  it('permite acceso cuando hay sesión activa', () => {
    useAuthStore.setState({
      user: mockAdminProfile, session: { user: { id: 'user-admin-123' } }, isAuthenticated: true,
    });
    render(
      <MemoryRouter initialEntries={['/recepcion']}>
        <AuthGuard>
          <div data-testid="guarded">Visible</div>
        </AuthGuard>
      </MemoryRouter>
    );
    expect(screen.getByTestId('guarded')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-012: RoleGuard — Permite acceso a ruta permitida según rol
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-012: RoleGuard permite acceso a ruta permitida', () => {
  it('permite a recepcionista en /recepcion', () => {
    useAuthStore.setState({ user: mockRecepcionistaProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/recepcion', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div data-testid="ok">OK</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('ok')).toBeTruthy();
  });

  it('permite a admin en /configuracion', () => {
    useAuthStore.setState({ user: mockAdminProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/configuracion', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div data-testid="cfg">Config</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('cfg')).toBeTruthy();
  });

  it('permite a limpieza en /limpieza', () => {
    useAuthStore.setState({
      user: { id: 'u1', role: 'limpieza', full_name: 'Limpieza', email: 'l@h.com' },
      session: {}, isAuthenticated: true,
    });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/limpieza', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div data-testid="lim">Limpieza</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('lim')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-013: RoleGuard — Redirección por rol si no tiene permiso
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-013: RoleGuard redirige si no tiene permiso', () => {
  it('redirige a recepcionista de /dev a /recepcion', () => {
    useAuthStore.setState({ user: mockRecepcionistaProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/dev', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div>No visible</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/recepcion');
  });

  it('redirige a limpieza de /caja a /limpieza', () => {
    useAuthStore.setState({
      user: { id: 'u1', role: 'limpieza', full_name: 'L', email: 'l@h.com' },
      session: {}, isAuthenticated: true,
    });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/caja', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div>No visible</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/limpieza');
  });

  it('permite acceso a ruta no mapeada (sin restricción)', () => {
    useAuthStore.setState({ user: mockDeveloperProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/about', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div data-testid="ok">OK</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('ok')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-014: RoleGuard — Redirección al visitar "/" según rol
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-014: RoleGuard redirige al visitar / según rol', () => {
  it('redirige a recepcionista a /recepcion al visitar /', () => {
    useAuthStore.setState({ user: mockRecepcionistaProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div>No</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/recepcion');
  });

  it('redirige a limpieza a /limpieza al visitar /', () => {
    useAuthStore.setState({
      user: { id: 'u1', role: 'limpieza', full_name: 'L', email: 'l@h.com' },
      session: {}, isAuthenticated: true,
    });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div>No</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/limpieza');
  });

  it('no redirige a admin al visitar /', () => {
    useAuthStore.setState({ user: mockAdminProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/', search: '', hash: '', state: null }
    );
    render(<MemoryRouter><RoleGuard><div data-testid="admin">Admin</div></RoleGuard></MemoryRouter>);
    expect(screen.getByTestId('admin')).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-015: useAuthStore — Gestión de estado
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-015: useAuthStore — Gestión de estado', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, hotelId: null, isAuthenticated: false });
  });

  it('setSession marca como autenticado', () => {
    useAuthStore.getState().setSession({ user: { id: 'u1' }, access_token: 'tok' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setSession(null) marca como no autenticado', () => {
    useAuthStore.getState().setSession(null);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('setUser actualiza hotelId y localStorage', () => {
    useAuthStore.getState().setUser(mockAdminProfile);
    expect(useAuthStore.getState().hotelId).toBe('hotel-001');
    expect(localStorage.getItem('hotel_activo_id')).toBe('hotel-001');
  });

  it('setUser sin hotel_id preserva hotelId existente', () => {
    useAuthStore.getState().setHotelId('hotel-existente');
    useAuthStore.getState().setUser({ ...mockAdminProfile, hotel_id: undefined });
    expect(useAuthStore.getState().hotelId).toBe('hotel-existente');
  });

  it('setUser(null) limpia usuario', () => {
    useAuthStore.getState().setUser(mockAdminProfile);
    useAuthStore.getState().setUser(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('setHotelId guarda en localStorage', () => {
    useAuthStore.getState().setHotelId('hotel-xyz');
    expect(localStorage.getItem('hotel_activo_id')).toBe('hotel-xyz');
  });

  it('setHotelId(null) elimina de localStorage', () => {
    localStorage.setItem('hotel_activo_id', 'hotel-001');
    useAuthStore.getState().setHotelId(null);
    expect(localStorage.getItem('hotel_activo_id')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-016: clearAuth — Limpieza completa del estado
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-016: clearAuth resetea el store', () => {
  it('limpia todos los campos', () => {
    useAuthStore.getState().setSession({ user: { id: 'u1' } });
    useAuthStore.getState().setUser(mockAdminProfile);
    useAuthStore.getState().setHotelId('hotel-001');
    useAuthStore.getState().clearAuth();
    const s = useAuthStore.getState();
    expect(s.user).toBeNull();
    expect(s.session).toBeNull();
    expect(s.hotelId).toBeNull();
    expect(s.isAuthenticated).toBe(false);
  });

  it('elimina hotel_activo_id de localStorage', () => {
    localStorage.setItem('hotel_activo_id', 'hotel-001');
    useAuthStore.getState().clearAuth();
    expect(localStorage.getItem('hotel_activo_id')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-017: AuthGuard + RoleGuard — Comportamiento combinado
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-017: AuthGuard + RoleGuard combinados', () => {
  it('admin pasa ambos guards en /ventas', () => {
    useAuthStore.setState({ user: mockAdminProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/ventas', search: '', hash: '', state: null }
    );
    render(
      <MemoryRouter>
        <AuthGuard><RoleGuard><div data-testid="ok">OK</div></RoleGuard></AuthGuard>
      </MemoryRouter>
    );
    expect(screen.getByTestId('ok')).toBeTruthy();
  });

  it('recepcionista bloqueado en /configuracion por RoleGuard', () => {
    useAuthStore.setState({ user: mockRecepcionistaProfile, session: {}, isAuthenticated: true });
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(
      { pathname: '/configuracion', search: '', hash: '', state: null }
    );
    render(
      <MemoryRouter>
        <AuthGuard><RoleGuard><div>No</div></RoleGuard></AuthGuard>
      </MemoryRouter>
    );
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/recepcion');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH-018: loadUserProfile — Usuario desactivado (soft-delete)
// ══════════════════════════════════════════════════════════════════════════════

describe('AUTH-018: Rechazar usuario desactivado (activo=false)', () => {
  it('lanza error cuando el perfil tiene activo=false', async () => {
    const inactiveProfile = {
      id: 'user-inactive', email: 'inactive@hotel.com',
      full_name: 'Usuario Inactivo', role: 'recepcionista',
      hotel_id: 'hotel-001', activo: false,
    };
    createProfileChain({ data: inactiveProfile, error: null });

    await expect(AuthService.loadUserProfile('user-inactive'))
      .rejects.toThrow('Usuario desactivado. Contacta al administrador.');
  });

  it('permite acceso a usuario con activo=true (por defecto)', async () => {
    const activeProfile = {
      ...mockAdminProfile,
      activo: true,
    };
    createProfileChain({ data: activeProfile, error: null });

    const profile = await AuthService.loadUserProfile('user-admin-123');
    expect(profile.role).toBe('admin');
    expect(profile.activo).toBe(true);
  });

  it('permite acceso a usuario sin campo activo (backward compat)', async () => {
    // Usuarios existentes antes de la migración no tienen el campo activo
    createProfileChain({ data: mockAdminProfile, error: null });

    const profile = await AuthService.loadUserProfile('user-admin-123');
    expect(profile.role).toBe('admin');
    // activo no está definido, pero no debe lanzar error
  });
});
