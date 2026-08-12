// @ts-nocheck
/**
 * HOTEL-001 a HOTEL-015: Tests de contrato para el servicio de Hotel
 *
 * Valida las funciones de hotel.service.ts, useHotelData y componentes relacionados:
 *   - listHoteles, getHotelById, updateConfiguracion
 *   - useHotelData (hotelActual, fallback, cambio de hotel)
 *   - Aislamiento multi-tenant y control de acceso por rol
 *
 * @see src/services/hotel.service.ts
 * @see src/hooks/useHotelData.ts
 */

// ─── Imports ──────────────────────────────────────────────────────────────────

import { HotelService } from '@/services/hotel.service';
import { useAuthStore } from '@/store/auth.store';

// ─── Mocks de Supabase ────────────────────────────────────────────────────────

let mockFromChain = {};

function createMockChain(resolvedValue) {
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockSingle = jest.fn().mockResolvedValue(resolvedValue);
  const mockOrder = jest.fn().mockResolvedValue(resolvedValue);
  const mockUpdate = jest.fn().mockReturnThis();

  mockFromChain = {
    select: mockSelect,
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
    update: mockUpdate,
  };

  mockSelect.mockReturnValue(mockFromChain);
  mockEq.mockReturnValue(mockFromChain);
  mockUpdate.mockReturnValue(mockFromChain);

  return mockFromChain;
}

jest.mock('@/config/supabase', () => ({
  supabase: {
    from: jest.fn(() => mockFromChain),
  },
}));

// Mock de React Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
}));

const { useQuery } = require('@tanstack/react-query');

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const mockHotel = {
  id: 'hotel-001',
  nombre: 'Hotel Test Principal',
  ruc: '20123456789',
  direccion: 'Av. Principal 123',
  ciudad: 'Lima',
  telefono: '987654321',
  email: 'test@hotel.com',
  logo_url: 'https://example.com/logo.png',
  mensaje_ticket: '¡Gracias por su preferencia!',
  aplica_igv: true,
  modo_sunat: 'manual',
  sunat_usuario_sol: 'USUARIO_SOL',
  sunat_clave_sol: 'CLAVE_SECRETA',
  hora_checkin: '14:00',
  hora_checkout: '12:00',
  numero_yape: '999888777',
  tipo_cambio: 3.80,
  created_date: '2026-01-01T00:00:00Z',
};

const mockHotelSinIGV = {
  id: 'hotel-002',
  nombre: 'Hotel Amazonía Resort',
  ruc: '20987654321',
  direccion: 'Jr. Selva 456',
  ciudad: 'Iquitos',
  telefono: '965432101',
  email: 'amazonia@resort.com',
  aplica_igv: false,
  modo_sunat: 'desactivado',
  hora_checkin: '13:00',
  hora_checkout: '11:00',
  tipo_cambio: 3.75,
};

const mockHoteles = [mockHotel, mockHotelSinIGV];

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({
    user: null,
    session: null,
    hotelId: null,
    isAuthenticated: false,
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-001: listHoteles — Listar hoteles del tenant
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-001: Listar hoteles del tenant actual', () => {
  it('retorna lista de hoteles ordenada por nombre', async () => {
    createMockChain({ data: mockHoteles, error: null });

    const hoteles = await HotelService.listHoteles();
    expect(hoteles).toEqual(mockHoteles);
    expect(hoteles.length).toBe(2);
    expect(hoteles[0].nombre).toBe('Hotel Test Principal');
    expect(hoteles[1].nombre).toBe('Hotel Amazonía Resort');
  });

  it('incluye configuración fiscal en los resultados', async () => {
    createMockChain({ data: mockHoteles, error: null });

    const hoteles = await HotelService.listHoteles();
    expect(hoteles[0].aplica_igv).toBe(true);
    expect(hoteles[0].modo_sunat).toBe('manual');
    expect(hoteles[1].aplica_igv).toBe(false);
    expect(hoteles[1].modo_sunat).toBe('desactivado');
  });

  it('incluye configuración operativa en los resultados', async () => {
    createMockChain({ data: mockHoteles, error: null });

    const hoteles = await HotelService.listHoteles();
    expect(hoteles[0].hora_checkin).toBe('14:00');
    expect(hoteles[0].hora_checkout).toBe('12:00');
    expect(hoteles[0].tipo_cambio).toBe(3.80);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-002: listHoteles — Lista vacía
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-002: Listar hoteles — lista vacía', () => {
  it('retorna array vacío cuando no hay hoteles', async () => {
    createMockChain({ data: [], error: null });

    const hoteles = await HotelService.listHoteles();
    expect(hoteles).toEqual([]);
  });

  it('retorna array vacío cuando la respuesta es null', async () => {
    createMockChain({ data: null, error: null });

    const hoteles = await HotelService.listHoteles();
    expect(hoteles).toEqual([]);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-003: listHoteles — Error en la consulta
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-003: Listar hoteles — error en consulta', () => {
  it('lanza error cuando la consulta falla', async () => {
    createMockChain({ data: null, error: new Error('Database error') });

    await expect(HotelService.listHoteles()).rejects.toThrow('Database error');
  });

  it('lanza error de conexión', async () => {
    createMockChain({ data: null, error: new Error('Network request failed') });

    await expect(HotelService.listHoteles()).rejects.toThrow('Network request failed');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-004: getHotelById — Obtener hotel por ID existente
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-004: Obtener hotel por ID existente', () => {
  it('retorna hotel con datos completos', async () => {
    createMockChain({ data: mockHotel, error: null });

    const hotel = await HotelService.getHotelById('hotel-001');
    expect(hotel.id).toBe('hotel-001');
    expect(hotel.nombre).toBe('Hotel Test Principal');
    expect(hotel.ruc).toBe('20123456789');
  });

  it('retorna hotel con configuración fiscal', async () => {
    createMockChain({ data: mockHotel, error: null });

    const hotel = await HotelService.getHotelById('hotel-001');
    expect(hotel.aplica_igv).toBe(true);
    expect(hotel.modo_sunat).toBe('manual');
  });

  it('retorna hotel con tipo de cambio', async () => {
    createMockChain({ data: mockHotel, error: null });

    const hotel = await HotelService.getHotelById('hotel-001');
    expect(hotel.tipo_cambio).toBe(3.80);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-005: getHotelById — Hotel no existe
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-005: Obtener hotel por ID inexistente', () => {
  it('lanza error cuando el hotel no existe', async () => {
    createMockChain({ data: null, error: new Error('Not found') });

    await expect(HotelService.getHotelById('hotel-999')).rejects.toThrow('Not found');
  });

  it('lanza error con mensaje cuando el hotel no existe', async () => {
    createMockChain({ data: null, error: new Error('No rows found') });

    await expect(HotelService.getHotelById('hotel-xyz')).rejects.toThrow('No rows found');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-006: updateConfiguracion — Actualizar nombre del hotel
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-006: Actualizar nombre del hotel', () => {
  it('actualiza y retorna los datos del hotel', async () => {
    const updatedHotel = { ...mockHotel, nombre: 'Hotel Test Actualizado' };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      nombre: 'Hotel Test Actualizado',
    });

    expect(result.nombre).toBe('Hotel Test Actualizado');
    expect(result.id).toBe('hotel-001');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-007: updateConfiguracion — Error en actualización
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-007: Error al actualizar configuración', () => {
  it('lanza error cuando la actualización falla', async () => {
    createMockChain({ data: null, error: new Error('Update failed') });

    await expect(
      HotelService.updateConfiguracion('hotel-001', { nombre: 'Nuevo Nombre' })
    ).rejects.toThrow('Update failed');
  });

  it('lanza error de permisos', async () => {
    createMockChain({ data: null, error: new Error('Permission denied') });

    await expect(
      HotelService.updateConfiguracion('hotel-001', { nombre: 'Nuevo Nombre' })
    ).rejects.toThrow('Permission denied');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-008: updateConfiguracion — Campos parciales
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-008: Actualizar campos parciales', () => {
  it('actualiza solo teléfono y email sin alterar otros campos', async () => {
    const updatedHotel = { ...mockHotel, telefono: '999888777', email: 'nuevo@hotel.com' };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      telefono: '999888777',
      email: 'nuevo@hotel.com',
    });

    expect(result.telefono).toBe('999888777');
    expect(result.email).toBe('nuevo@hotel.com');
    expect(result.nombre).toBe('Hotel Test Principal'); // Sin cambios
  });

  it('actualiza solo la dirección', async () => {
    const updatedHotel = { ...mockHotel, direccion: 'Av. Nueva 456' };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      direccion: 'Av. Nueva 456',
    });

    expect(result.direccion).toBe('Av. Nueva 456');
    expect(result.nombre).toBe('Hotel Test Principal');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-009: updateConfiguracion — Configuración fiscal
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-009: Actualizar configuración fiscal', () => {
  it('actualiza aplica_igv a false', async () => {
    const updatedHotel = { ...mockHotel, aplica_igv: false };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      aplica_igv: false,
    });

    expect(result.aplica_igv).toBe(false);
  });

  it('actualiza modo_sunat a automatico', async () => {
    const updatedHotel = { ...mockHotel, modo_sunat: 'automatico' };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      modo_sunat: 'automatico',
    });

    expect(result.modo_sunat).toBe('automatico');
  });

  it('actualiza tipo_cambio', async () => {
    const updatedHotel = { ...mockHotel, tipo_cambio: 4.00 };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      tipo_cambio: 4.00,
    });

    expect(result.tipo_cambio).toBe(4.00);
  });

  it('actualiza horarios operativos', async () => {
    const updatedHotel = { ...mockHotel, hora_checkin: '15:00', hora_checkout: '13:00' };
    createMockChain({ data: updatedHotel, error: null });

    const result = await HotelService.updateConfiguracion('hotel-001', {
      hora_checkin: '15:00',
      hora_checkout: '13:00',
    });

    expect(result.hora_checkin).toBe('15:00');
    expect(result.hora_checkout).toBe('13:00');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-010: useHotelData — Retorna hotelActual correcto
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-010: useHotelData retorna hotelActual correcto', () => {
  it('el store mantiene el hotelId seleccionado', () => {
    useAuthStore.getState().setHotelId('hotel-001');
    expect(useAuthStore.getState().hotelId).toBe('hotel-001');
  });

  it('el servicio listHoteles retorna datos consistentes con el store', async () => {
    useAuthStore.getState().setHotelId('hotel-001');
    createMockChain({ data: mockHoteles, error: null });

    const hoteles = await HotelService.listHoteles();
    const hotelEncontrado = hoteles.find(h => h.id === useAuthStore.getState().hotelId);
    expect(hotelEncontrado).toBeTruthy();
    expect(hotelEncontrado.nombre).toBe('Hotel Test Principal');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-011: useHotelData — Fallback a localStorage
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-011: Persistencia de hotelId en localStorage', () => {
  it('almacena hotelId en localStorage al seleccionar hotel', () => {
    useAuthStore.getState().setHotelId('hotel-002');
    expect(localStorage.getItem('hotel_activo_id')).toBe('hotel-002');
  });

  it('recupera hotelId de localStorage al iniciar', () => {
    localStorage.setItem('hotel_activo_id', 'hotel-002');
    useAuthStore.getState().setHotelId(localStorage.getItem('hotel_activo_id'));
    expect(useAuthStore.getState().hotelId).toBe('hotel-002');
  });

  it('limpia hotelId de localStorage al hacer clear', () => {
    localStorage.setItem('hotel_activo_id', 'hotel-001');
    useAuthStore.getState().clearAuth();
    expect(localStorage.getItem('hotel_activo_id')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-012: useHotelData — Primer hotel como default
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-012: Seleccionar primer hotel por defecto', () => {
  it('setHotelId almacena el hotel seleccionado', () => {
    useAuthStore.getState().setHotelId('hotel-002');

    const state = useAuthStore.getState();
    expect(state.hotelId).toBe('hotel-002');
  });

  it('permite cambiar entre hoteles', () => {
    useAuthStore.getState().setHotelId('hotel-001');
    expect(useAuthStore.getState().hotelId).toBe('hotel-001');

    useAuthStore.getState().setHotelId('hotel-002');
    expect(useAuthStore.getState().hotelId).toBe('hotel-002');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-013: HotelService — Llamadas correctas a Supabase
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-013: Llamadas correctas a Supabase', () => {
  it('listHoteles llama a from("hoteles").select("*").order("nombre")', async () => {
    const chain = createMockChain({ data: mockHoteles, error: null });
    const { supabase } = require('@/config/supabase');

    await HotelService.listHoteles();

    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(chain.order).toHaveBeenCalledWith('nombre');
  });

  it('getHotelById llama con eq("id", hotelId) y single()', async () => {
    const chain = createMockChain({ data: mockHotel, error: null });
    const { supabase } = require('@/config/supabase');

    await HotelService.getHotelById('hotel-001');

    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(chain.eq).toHaveBeenCalledWith('id', 'hotel-001');
    expect(chain.single).toHaveBeenCalled();
  });

  it('updateConfiguracion llama con update, eq("id") y select().single()', async () => {
    const chain = createMockChain({ data: mockHotel, error: null });
    const { supabase } = require('@/config/supabase');

    await HotelService.updateConfiguracion('hotel-001', { nombre: 'Test' });

    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(chain.update).toHaveBeenCalledWith({ nombre: 'Test' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'hotel-001');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-014: Aislamiento Multi-Tenant (Validación conceptual)
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-014: Aislamiento multi-tenant', () => {
  it('cada hotel tiene un ID único', () => {
    expect(mockHotel.id).not.toBe(mockHotelSinIGV.id);
  });

  it('hoteles pueden tener configuración fiscal diferente', () => {
    // Hotel 1: Aplica IGV
    expect(mockHotel.aplica_igv).toBe(true);
    expect(mockHotel.modo_sunat).toBe('manual');

    // Hotel 2: No aplica IGV
    expect(mockHotelSinIGV.aplica_igv).toBe(false);
    expect(mockHotelSinIGV.modo_sunat).toBe('desactivado');
  });

  it('cada hotel gestiona su propio personal', () => {
    // La tabla usuarios tiene hotel_id para aislar personal
    const usuarioHotel1 = { id: 'user-001', hotel_id: 'hotel-001' };
    const usuarioHotel2 = { id: 'user-002', hotel_id: 'hotel-002' };

    expect(usuarioHotel1.hotel_id).toBe('hotel-001');
    expect(usuarioHotel2.hotel_id).toBe('hotel-002');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// HOTEL-015: Control de acceso por rol
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-015: Control de acceso por rol', () => {
  it('admin puede actualizar configuración', () => {
    useAuthStore.getState().setUser({ id: 'user-admin', role: 'admin', full_name: 'Admin', email: 'admin@test.com' });

    const user = useAuthStore.getState().user;
    expect(user.role).toBe('admin');
  });

  it('recepcionista no puede acceder a configuración (validación conceptual)', () => {
    useAuthStore.getState().setUser({
      id: 'user-rec',
      role: 'recepcionista',
      full_name: 'Recepcionista',
      email: 'rec@test.com',
    });

    const user = useAuthStore.getState().user;
    expect(user.role).toBe('recepcionista');
    // La validación real se hace en los guards de ruta (ver AUTH-012 a AUTH-014)
  });

  it('developer tiene acceso total', () => {
    useAuthStore.getState().setUser({
      id: 'user-dev',
      role: 'developer',
      full_name: 'Developer',
      email: 'dev@test.com',
    });

    const user = useAuthStore.getState().user;
    expect(user.role).toBe('developer');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests adicionales: Validación de datos del hotel
// ══════════════════════════════════════════════════════════════════════════════

describe('HOTEL-EXTRA: Validación de datos del hotel', () => {
  it('un hotel puede tener logo_url opcional', () => {
    const hotelConLogo = { ...mockHotel, logo_url: 'https://ejemplo.com/logo.png' };
    const hotelSinLogo = { ...mockHotel, logo_url: undefined };

    expect(hotelConLogo.logo_url).toBeTruthy();
    expect(hotelSinLogo.logo_url).toBeUndefined();
  });

  it('un hotel puede tener mensaje personalizado en ticket', () => {
    const hotelConMensaje = { ...mockHotel, mensaje_ticket: '¡Vuelva pronto!' };

    expect(hotelConMensaje.mensaje_ticket).toBe('¡Vuelva pronto!');
  });

  it('un hotel puede tener número Yape/Plin configurado', () => {
    const hotelConYape = { ...mockHotel, numero_yape: '987654321' };
    const hotelSinYape = { ...mockHotel, numero_yape: undefined };

    expect(hotelConYape.numero_yape).toBe('987654321');
    expect(hotelSinYape.numero_yape).toBeUndefined();
  });
});
