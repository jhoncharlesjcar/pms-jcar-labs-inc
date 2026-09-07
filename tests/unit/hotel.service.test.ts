import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HotelService } from '@/services/hotel.service';
import { supabase } from '@/config/supabase';

vi.mock('@/config/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('hotel.service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listHoteles retorna lista ordenada de hoteles', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: '1', nombre: 'Hotel Central' }], error: null });
    const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const hoteles = await HotelService.listHoteles();
    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockOrder).toHaveBeenCalledWith('nombre');
    expect(hoteles).toHaveLength(1);
    expect(hoteles[0].nombre).toBe('Hotel Central');
  });

  it('getHotelById retorna el hotel correspondiente', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'h-1', nombre: 'Hotel Sol' }, error: null });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    const hotel = await HotelService.getHotelById('h-1');
    expect(supabase.from).toHaveBeenCalledWith('hoteles');
    expect(mockEq).toHaveBeenCalledWith('id', 'h-1');
    expect(hotel.nombre).toBe('Hotel Sol');
  });

  it('updateConfiguracion actualiza datos del hotel', async () => {
    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'h-1', ruc: '20123456789' }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    (supabase.from as any).mockReturnValue({ update: mockUpdate });

    const updated = await HotelService.updateConfiguracion('h-1', { ruc: '20123456789' });
    expect(mockUpdate).toHaveBeenCalledWith({ ruc: '20123456789' });
    expect(mockEq).toHaveBeenCalledWith('id', 'h-1');
    expect(updated.ruc).toBe('20123456789');
  });

  it('propaga error si la consulta falla', async () => {
    const mockSelect = vi.fn().mockReturnValue({
      order: vi.fn().mockResolvedValue({ data: null, error: new Error('DB error') }),
    });
    (supabase.from as any).mockReturnValue({ select: mockSelect });

    await expect(HotelService.listHoteles()).rejects.toThrow('DB error');
  });
});
