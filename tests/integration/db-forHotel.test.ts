// @ts-nocheck
/**
 * DB-FORHOTEL-001 a DB-FORHOTEL-010: Tests de integración para db.forHotel
 *
 * Valida el proxy multi-tenant que inyecta hotel_id automáticamente:
 *   - Inyección de hotel_id en create
 *   - Filtro automático en list y filter
 *   - Cache de instancias scoped
 *   - Manejo de casos edge (hotelId null, cache invalidation)
 *
 * @see src/api/db.js
 * @see specs/domain-hotel.md — RN-HOTEL-010
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

import { db } from '@/api/db';

// ─── Mocks de Supabase ────────────────────────────────────────────────────────

let mockQuery = {};

function createMockChain() {
  const mockSelect = jest.fn().mockReturnThis();
  const mockInsert = jest.fn().mockReturnThis();
  const mockUpdate = jest.fn().mockReturnThis();
  const mockDelete = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });
  const mockSingle = jest.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null });
  const mockLimit = jest.fn().mockResolvedValue({ data: [], error: null });

  mockQuery = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    eq: mockEq,
    order: mockOrder,
    single: mockSingle,
    limit: mockLimit,
  };

  // Encadenamiento de métodos
  mockSelect.mockReturnValue(mockQuery);
  mockInsert.mockReturnValue(mockQuery);
  mockUpdate.mockReturnValue(mockQuery);
  mockDelete.mockReturnValue(mockQuery);
  mockEq.mockReturnValue(mockQuery);
  mockOrder.mockReturnValue(mockQuery);
  mockLimit.mockReturnValue(mockQuery);

  return mockQuery;
}

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => mockQuery),
    auth: {
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const { supabase } = require('@/lib/supabaseClient');

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const HOTEL_ID = 'hotel-test-001';
const HOTEL_ID_2 = 'hotel-test-002';

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-001: Inyección de hotel_id en create
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-001: Inyección de hotel_id en create', () => {
  it('inyecta hotel_id al crear una habitación', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Habitacion.create({
      numero: '103',
      tipo: 'simple',
      precio_noche: 80,
    });

    // Verificar que from fue llamado con la tabla correcta
    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    // Verificar que insert incluye hotel_id
    const insertCall = mockQuery.insert.mock.calls[0][0];
    expect(insertCall.hotel_id).toBe(HOTEL_ID);
    expect(insertCall.numero).toBe('103');
  });

  it('inyecta hotel_id al crear una reserva', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Reserva.create({
      huesped_nombre: 'Juan Perez',
      fecha_entrada: '2026-07-20',
      fecha_salida: '2026-07-22',
    });

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    const insertCall = mockQuery.insert.mock.calls[0][0];
    expect(insertCall.hotel_id).toBe(HOTEL_ID);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-002: Filtro automático en list
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-002: Filtro automático en list', () => {
  it('filtra por hotel_id al listar habitaciones', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Habitacion.list();

    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    expect(mockQuery.eq).toHaveBeenCalledWith('hotel_id', HOTEL_ID);
  });

  it('filtra por hotel_id al listar ventas', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Venta.list();

    expect(supabase.from).toHaveBeenCalledWith('ventas');
    expect(mockQuery.eq).toHaveBeenCalledWith('hotel_id', HOTEL_ID);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-003: Filtro combinado (filtros propios + hotel_id)
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-003: Filtro combinado con filtros propios', () => {
  it('combina filtro propio con hotel_id', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Habitacion.filter({ estado: 'ocupada' });

    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    // Debe haber llamado eq para hotel_id y eq para estado
    expect(mockQuery.eq).toHaveBeenCalledWith('hotel_id', HOTEL_ID);
    expect(mockQuery.eq).toHaveBeenCalledWith('estado', 'ocupada');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-004: Hotel entity usa 'id' no 'hotel_id'
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-004: Hotel entity filtra por id no hotel_id', () => {
  it('filtra por id cuando la entidad es Hotel', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Hotel.list();

    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    // Hotel debe filtrar por 'id' no por 'hotel_id'
    expect(mockQuery.eq).toHaveBeenCalledWith('id', HOTEL_ID);
  });

  it('ConfigHotel también filtra por id', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.ConfigHotel.list();

    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(mockQuery.eq).toHaveBeenCalledWith('id', HOTEL_ID);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-005: Comportamiento con hotelId null
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-005: Comportamiento con hotelId null', () => {
  it('retorna entities sin filtro cuando hotelId es null', async () => {
    createMockChain();
    const hotelDb = db.forHotel(null);

    await hotelDb.Habitacion.list();

    // Sin hotelId, NO debe filtrar por hotel_id
    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    expect(mockQuery.eq).not.toHaveBeenCalledWith('hotel_id', null);
  });

  it('retorna entities sin filtro cuando hotelId es undefined', async () => {
    createMockChain();
    const hotelDb = db.forHotel(undefined);

    await hotelDb.Habitacion.list();

    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    expect(mockQuery.eq).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-006: Cache de instancias scoped
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-006: Cache de instancias scoped', () => {
  it('retorna la misma instancia cacheada para el mismo hotelId', () => {
    const hotelDb1 = db.forHotel(HOTEL_ID);
    const hotelDb2 = db.forHotel(HOTEL_ID);

    expect(hotelDb1).toBe(hotelDb2);
  });

  it('retorna instancias diferentes para diferentes hotelIds', () => {
    const hotelDb1 = db.forHotel(HOTEL_ID);
    const hotelDb2 = db.forHotel(HOTEL_ID_2);

    expect(hotelDb1).not.toBe(hotelDb2);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-007: Operaciones CRUD completas con forHotel
// ══════════════════════════════════════════════════════════════════════════════

describe('DB-FORHOTEL-007: CRUD completo con forHotel', () => {
  it('create inyecta hotel_id', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.VentaPOS.create({ total: 150, metodo_pago: 'efectivo' });

    expect(supabase.from).toHaveBeenCalledWith('ventas_pos');
    expect(mockQuery.insert.mock.calls[0][0].hotel_id).toBe(HOTEL_ID);
  });

  it('update no inyecta hotel_id (usa el id del registro)', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Habitacion.update('hab-001', { precio_noche: 100 });

    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'hab-001');
  });

  it('delete usa el id del registro', async () => {
    createMockChain();
    const hotelDb = db.forHotel(HOTEL_ID);

    await hotelDb.Habitacion.delete('hab-001');

    expect(supabase.from).toHaveBeenCalledWith('habitaciones');
    expect(mockQuery.eq).toHaveBeenCalledWith('id', 'hab-001');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// DB-FORHOTEL-008: db.auth.logout — limpieza de sesión
// ══════════════════════════════════════════════════════════════════════════════
// Nota: window.location.replace es readonly en jsdom, por lo que no se mockea.
// Las aserciones se centran en lo que podemos verificar: cleanup de storage y
// llamada a signOut.

describe('DB-FORHOTEL-008: Logout limpia sesión', () => {
  beforeEach(() => {
    localStorage.setItem('sb-token', 'test-token');
    localStorage.setItem('hotel_activo_id', 'hotel-001');
    localStorage.setItem('theme', 'dark');
    sessionStorage.setItem('test', 'value');
  });

  it('limpia localStorage de claves sb-', async () => {
    await db.auth.logout();

    expect(localStorage.getItem('sb-token')).toBeNull();
    // No debe borrar configuraciones de tema/PWA
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('limpia sessionStorage', async () => {
    await db.auth.logout();

    expect(sessionStorage.getItem('test')).toBeNull();
  });

  it('llama a supabase.auth.signOut', async () => {
    await db.auth.logout();

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
