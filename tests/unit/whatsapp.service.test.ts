import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhatsAppService } from '@/services/whatsapp.service';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/auditLogger', () => ({
  registrarLog: vi.fn(),
}));

vi.mock('@/config/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { checkin_url: 'https://pms.test/checkin/abc' }, error: null }),
    },
  },
}));

describe('whatsapp.service.ts', () => {
  let mockWindowOpen: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindowOpen = {
      location: { href: '' },
      close: vi.fn(),
    };
    (globalThis as any).window = {
      open: vi.fn().mockReturnValue(mockWindowOpen),
      location: { href: '' },
    };
  });

  it('falla si la reserva no tiene telefono', async () => {
    const reserva = {
      id: 'res-1',
      huesped_nombre: 'Carlos Perez',
      huesped_telefono: '',
      estado: 'confirmada',
    } as any;

    const result = await WhatsAppService.enviarMensajeReserva(reserva, { nombre: 'Hotel Sol' });
    expect(result).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('El huésped no tiene número de teléfono registrado');
  });

  it('formatea telefono peruano de 9 digitos con 51', async () => {
    const reserva = {
      id: 'res-1',
      huesped_nombre: 'Carlos Perez',
      huesped_telefono: '987654321',
      estado: 'confirmada',
      habitacion_numero: '101',
      fecha_entrada: '2026-10-01',
      fecha_salida: '2026-10-03',
      total: 250,
      numero_reserva: 'RES-001',
    } as any;

    const result = await WhatsAppService.enviarMensajeReserva(reserva, { nombre: 'Hotel Sol' });
    expect(result).toBe(true);
    expect(mockWindowOpen.location.href).toContain('phone=51987654321');
    expect(mockWindowOpen.location.href).toContain(encodeURIComponent('¡Hola, Carlos Perez!'));
    expect(toast.success).toHaveBeenCalledWith('Enlace de WhatsApp abierto');
  });

  it('genera mensaje para estadia activa', async () => {
    const reserva = {
      id: 'res-2',
      huesped_nombre: 'Ana Gómez',
      huesped_telefono: '+51 912 345 678',
      estado: 'activa',
      habitacion_numero: '202',
      fecha_entrada: '2026-10-01',
      fecha_salida: '2026-10-05',
      total: 500,
      numero_reserva: 'RES-002',
    } as any;

    const result = await WhatsAppService.enviarMensajeReserva(reserva, { nombre: 'Hotel Sol' });
    expect(result).toBe(true);
    expect(mockWindowOpen.location.href).toContain('phone=51912345678');
    expect(mockWindowOpen.location.href).toContain(encodeURIComponent('disfrutando tu estadía'));
  });

  it('genera mensaje de despedida para reserva finalizada', async () => {
    const reserva = {
      id: 'res-3',
      huesped_nombre: 'Luis Ramos',
      huesped_telefono: '51999888777',
      estado: 'finalizada',
      habitacion_numero: '303',
      fecha_entrada: '2026-09-01',
      fecha_salida: '2026-09-03',
      total: 300,
      numero_reserva: 'RES-003',
    } as any;

    const result = await WhatsAppService.enviarMensajeReserva(reserva, { nombre: 'Hotel Sol' });
    expect(result).toBe(true);
    expect(mockWindowOpen.location.href).toContain(encodeURIComponent('agradecerte por haberte hospedado'));
  });
});
