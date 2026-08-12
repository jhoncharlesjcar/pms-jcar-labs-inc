// @ts-nocheck
/**
 * RES-001 a RES-010: Tests de contrato para el servicio de Reservas
 *
 * Valida las 5 funciones de reservas.service.ts:
 *   - getReservasByHotel, getReservaById
 *   - crearReserva, actualizarEstado, actualizarReserva
 *
 * @see src/services/reservas.service.ts
 * @see specs/domain-recepcion.md
 */

import { ReservasService } from '@/services/reservas.service';

// ─── Mocks de Supabase ────────────────────────────────────────────────────

let mockFromChain = {};

function createMockChain(resolvedValue) {
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockSingle = jest.fn().mockResolvedValue(resolvedValue);
  const mockOrder = jest.fn().mockResolvedValue(resolvedValue);
  const mockInsert = jest.fn().mockReturnThis();
  const mockUpdate = jest.fn().mockReturnThis();

  mockFromChain = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
    insert: mockInsert,
    update: mockUpdate,
  };

  mockSelect.mockReturnValue(mockFromChain);
  mockEq.mockReturnValue(mockFromChain);
  mockInsert.mockReturnValue(mockFromChain);
  mockUpdate.mockReturnValue(mockFromChain);

  return mockFromChain;
}

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockFromChain),
  },
}));

// ─── Datos de prueba ─────────────────────────────────────────────────────

const mockReserva = {
  id: 'reserva-001',
  hotel_id: 'hotel-001',
  habitacion_id: 'hab-101',
  habitacion_numero: '101',
  habitacion_tipo: 'matrimonial',
  huesped_nombre: 'Juan Pérez',
  huesped_dni: '12345678',
  huesped_telefono: '987654321',
  huesped_procedencia: 'Lima',
  nacionalidad: 'Peruana',
  motivo_viaje: 'turismo',
  fecha_entrada: '2026-07-15',
  fecha_salida: '2026-07-18',
  noches: 3,
  precio_noche: 120,
  total: 360,
  num_adultos: 2,
  num_ninos: 0,
  estado: 'activa',
  observaciones: 'Cliente frecuente',
  numero_reserva: 'R-001',
  created_date: '2026-07-14T10:00:00Z',
};

const mockReservaPendiente = {
  ...mockReserva,
  id: 'reserva-002',
  huesped_nombre: 'María López',
  estado: 'pendiente',
  numero_reserva: 'R-002',
};

const mockReservas = [mockReserva, mockReservaPendiente];

beforeEach(() => {
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
// RES-001: getReservasByHotel
// ════════════════════════════════════════════════════════════════════════════

describe('RES-001: getReservasByHotel — Listar reservas por hotel', () => {
  it('retorna lista de reservas del hotel', async () => {
    createMockChain({ data: mockReservas, error: null });

    const reservas = await ReservasService.getReservasByHotel('hotel-001');
    expect(reservas).toEqual(mockReservas);
    expect(reservas.length).toBe(2);
  });

  it('retorna datos completos de cada reserva', async () => {
    createMockChain({ data: mockReservas, error: null });

    const reservas = await ReservasService.getReservasByHotel('hotel-001');
    expect(reservas[0].huesped_nombre).toBe('Juan Pérez');
    expect(reservas[0].habitacion_numero).toBe('101');
    expect(reservas[0].total).toBe(360);
    expect(reservas[0].estado).toBe('activa');
  });

  it('retorna array vacío cuando no hay reservas', async () => {
    createMockChain({ data: [], error: null });

    const reservas = await ReservasService.getReservasByHotel('hotel-001');
    expect(reservas).toEqual([]);
  });

  it('retorna array vacío cuando la respuesta es null', async () => {
    createMockChain({ data: null, error: null });

    const reservas = await ReservasService.getReservasByHotel('hotel-001');
    expect(reservas).toEqual([]);
  });

  it('lanza error cuando la consulta falla', async () => {
    createMockChain({ data: null, error: new Error('Database error') });

    await expect(
      ReservasService.getReservasByHotel('hotel-001')
    ).rejects.toThrow('Database error');
  });

  it('llama a from(\"reservas\") con hotel_id y orden descendente', async () => {
    const chain = createMockChain({ data: mockReservas, error: null });
    const { supabase } = require('@/config/supabase');

    await ReservasService.getReservasByHotel('hotel-001');

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    expect(chain.eq).toHaveBeenCalledWith('hotel_id', 'hotel-001');
    expect(chain.order).toHaveBeenCalledWith('fecha_entrada', { ascending: false });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RES-002: getReservaById
// ════════════════════════════════════════════════════════════════════════════

describe('RES-002: getReservaById — Obtener reserva por ID', () => {
  it('retorna reserva con datos completos', async () => {
    createMockChain({ data: mockReserva, error: null });

    const reserva = await ReservasService.getReservaById('reserva-001');
    expect(reserva.id).toBe('reserva-001');
    expect(reserva.huesped_nombre).toBe('Juan Pérez');
    expect(reserva.total).toBe(360);
  });

  it('incluye datos del huésped y estadía', async () => {
    createMockChain({ data: mockReserva, error: null });

    const reserva = await ReservasService.getReservaById('reserva-001');
    expect(reserva.huesped_dni).toBe('12345678');
    expect(reserva.huesped_telefono).toBe('987654321');
    expect(reserva.noches).toBe(3);
    expect(reserva.precio_noche).toBe(120);
  });

  it('incluye estado y observaciones', async () => {
    createMockChain({ data: mockReserva, error: null });

    const reserva = await ReservasService.getReservaById('reserva-001');
    expect(reserva.estado).toBe('activa');
    expect(reserva.observaciones).toBe('Cliente frecuente');
  });

  it('lanza error si la reserva no existe', async () => {
    createMockChain({ data: null, error: new Error('Not found') });

    await expect(
      ReservasService.getReservaById('reserva-xyz')
    ).rejects.toThrow('Not found');
  });

  it('llama a from(\"reservas\").select(\"*\").eq(\"id\").single()', async () => {
    const chain = createMockChain({ data: mockReserva, error: null });
    const { supabase } = require('@/config/supabase');

    await ReservasService.getReservaById('reserva-001');

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    expect(chain.eq).toHaveBeenCalledWith('id', 'reserva-001');
    expect(chain.single).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RES-003: crearReserva
// ════════════════════════════════════════════════════════════════════════════

describe('RES-003: crearReserva — Registrar nueva reserva', () => {
  const nuevaReserva = {
    hotel_id: 'hotel-001',
    habitacion_id: 'hab-102',
    habitacion_numero: '102',
    habitacion_tipo: 'simple',
    huesped_nombre: 'Carlos Ruiz',
    huesped_dni: '87654321',
    huesped_telefono: '999888777',
    fecha_entrada: '2026-07-20',
    fecha_salida: '2026-07-22',
    noches: 2,
    precio_noche: 80,
    total: 160,
    num_adultos: 1,
    num_ninos: 0,
    estado: 'pendiente',
  };

  it('crea y retorna la reserva con ID generado', async () => {
    const mockCreada = { ...nuevaReserva, id: 'reserva-003', created_date: '2026-07-14T10:00:00Z' };
    createMockChain({ data: mockCreada, error: null });

    const result = await ReservasService.crearReserva(nuevaReserva);
    expect(result.id).toBe('reserva-003');
    expect(result.huesped_nombre).toBe('Carlos Ruiz');
  });

  it('lanza error si la creación falla', async () => {
    createMockChain({ data: null, error: new Error('Insert failed') });

    await expect(
      ReservasService.crearReserva(nuevaReserva)
    ).rejects.toThrow('Insert failed');
  });

  it('lanza error si faltan campos obligatorios (simulado por BD)', async () => {
    createMockChain({ data: null, error: new Error('null value in column "huesped_nombre" violates not-null constraint') });

    await expect(
      ReservasService.crearReserva({ ...nuevaReserva, huesped_nombre: '' })
    ).rejects.toThrow('not-null constraint');
  });

  it('llama a from(\"reservas\").insert().select().single()', async () => {
    const chain = createMockChain({ data: mockReserva, error: null });
    const { supabase } = require('@/config/supabase');

    await ReservasService.crearReserva(nuevaReserva);

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    expect(chain.insert).toHaveBeenCalledWith(nuevaReserva);
    expect(chain.single).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RES-004: actualizarEstado
// ════════════════════════════════════════════════════════════════════════════

describe('RES-004: actualizarEstado — Cambiar estado de una reserva', () => {
  it('actualiza estado a \"finalizada\"', async () => {
    const reservaFinalizada = { ...mockReserva, estado: 'finalizada' };
    createMockChain({ data: reservaFinalizada, error: null });

    const result = await ReservasService.actualizarEstado('reserva-001', 'finalizada');
    expect(result.estado).toBe('finalizada');
    expect(result.id).toBe('reserva-001');
  });

  it('actualiza estado a \"cancelada\"', async () => {
    const reservaCancelada = { ...mockReserva, estado: 'cancelada' };
    createMockChain({ data: reservaCancelada, error: null });

    const result = await ReservasService.actualizarEstado('reserva-001', 'cancelada');
    expect(result.estado).toBe('cancelada');
  });

  it('actualiza estado a \"activa\" (check-in)', async () => {
    const reservaActiva = { ...mockReservaPendiente, estado: 'activa' };
    createMockChain({ data: reservaActiva, error: null });

    const result = await ReservasService.actualizarEstado('reserva-002', 'activa');
    expect(result.estado).toBe('activa');
  });

  it('lanza error si la actualización falla', async () => {
    createMockChain({ data: null, error: new Error('Update failed') });

    await expect(
      ReservasService.actualizarEstado('reserva-001', 'finalizada')
    ).rejects.toThrow('Update failed');
  });

  it('llama a from(\"reservas\").update({estado}).eq(\"id\").select().single()', async () => {
    const chain = createMockChain({ data: mockReserva, error: null });
    const { supabase } = require('@/config/supabase');

    await ReservasService.actualizarEstado('reserva-001', 'finalizada');

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    expect(chain.update).toHaveBeenCalledWith({ estado: 'finalizada' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'reserva-001');
    expect(chain.single).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// RES-005: actualizarReserva — Actualizar datos generales
// ════════════════════════════════════════════════════════════════════════════

describe('RES-005: actualizarReserva — Actualizar datos generales', () => {
  it('actualiza datos del huésped', async () => {
    const reservaActualizada = {
      ...mockReserva,
      huesped_nombre: 'Juan Pérez Actualizado',
      huesped_telefono: '999111222',
    };
    createMockChain({ data: reservaActualizada, error: null });

    const result = await ReservasService.actualizarReserva('reserva-001', {
      huesped_nombre: 'Juan Pérez Actualizado',
      huesped_telefono: '999111222',
    });

    expect(result.huesped_nombre).toBe('Juan Pérez Actualizado');
    expect(result.huesped_telefono).toBe('999111222');
  });

  it('actualiza fechas de la reserva', async () => {
    const reservaActualizada = {
      ...mockReserva,
      fecha_entrada: '2026-07-16',
      fecha_salida: '2026-07-20',
    };
    createMockChain({ data: reservaActualizada, error: null });

    const result = await ReservasService.actualizarReserva('reserva-001', {
      fecha_entrada: '2026-07-16',
      fecha_salida: '2026-07-20',
    });

    expect(result.fecha_entrada).toBe('2026-07-16');
    expect(result.fecha_salida).toBe('2026-07-20');
  });

  it('actualiza observaciones', async () => {
    const reservaActualizada = { ...mockReserva, observaciones: 'Solicita cuna adicional' };
    createMockChain({ data: reservaActualizada, error: null });

    const result = await ReservasService.actualizarReserva('reserva-001', {
      observaciones: 'Solicita cuna adicional',
    });

    expect(result.observaciones).toBe('Solicita cuna adicional');
  });

  // La protección de hotel_id se verifica en tiempo de compilación:
  //   Partial<Omit<Reserva, 'id' | 'hotel_id'>>
  // TypeScript impide pasar hotel_id al tipado de la función.
  // En Jest no se puede validar esto en runtime (@ts-nocheck).

  it('lanza error si la actualización falla', async () => {
    createMockChain({ data: null, error: new Error('Update failed') });

    await expect(
      ReservasService.actualizarReserva('reserva-001', { huesped_nombre: 'Test' })
    ).rejects.toThrow('Update failed');
  });

  it('llama a from(\"reservas\").update().eq(\"id\").select().single()', async () => {
    const chain = createMockChain({ data: mockReserva, error: null });
    const { supabase } = require('@/config/supabase');

    await ReservasService.actualizarReserva('reserva-001', { observaciones: 'Test' });

    expect(supabase.from).toHaveBeenCalledWith('reservas');
    expect(chain.update).toHaveBeenCalledWith({ observaciones: 'Test' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'reserva-001');
    expect(chain.single).toHaveBeenCalled();
  });
});
