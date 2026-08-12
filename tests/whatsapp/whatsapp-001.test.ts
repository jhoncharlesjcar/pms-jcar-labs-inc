// @ts-nocheck
/**
 * WHATSAPP-001 a WHATSAPP-005: Tests de contrato para el servicio de WhatsApp
 *
 * Valida las funciones de whatsapp.service.js: enviarMensajeReserva,
 * generación de mensajes, formateo de teléfono y apertura de enlace.
 *
 * @see src/services/whatsapp.service.js
 */
import { WhatsAppService } from '@/services/whatsapp.service';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();
const mockRegistrarLog = jest.fn();
const mockWindowOpen = jest.fn();

jest.mock('sonner', () => ({
  toast: {
    error: (...args) => mockToastError(...args),
    success: (...args) => mockToastSuccess(...args),
  },
}));

jest.mock('@/lib/auditLogger', () => ({
  registrarLog: (...args) => mockRegistrarLog(...args),
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const reservaPendiente = {
  id: 'res-001',
  numero_reserva: 'W123456',
  huesped_nombre: 'Juan Perez',
  huesped_telefono: '987654321',
  habitacion_numero: '101',
  fecha_entrada: '2026-07-15',
  fecha_salida: '2026-07-18',
  total: 300,
  estado: 'pendiente',
};

const reservaActiva = {
  ...reservaPendiente,
  estado: 'activa',
};

const reservaFinalizada = {
  ...reservaPendiente,
  estado: 'finalizada',
};

const config = {
  nombre: 'Hotel Test',
};

const context = {
  hotelId: 'hotel-001',
  user: { id: 'user-123', full_name: 'Recepcionista' },
};

describe('WHATSAPP-001: Validación de teléfono', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna false y muestra error si no hay teléfono', () => {
    const result = WhatsAppService.enviarMensajeReserva(
      { ...reservaPendiente, huesped_telefono: '' },
      config,
      context
    );

    expect(result).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      'El huésped no tiene número de teléfono registrado'
    );
  });

  it('retorna false y muestra error si el teléfono es solo espacios', () => {
    const result = WhatsAppService.enviarMensajeReserva(
      { ...reservaPendiente, huesped_telefono: '   ' },
      config,
      context
    );

    expect(result).toBe(false);
    expect(mockToastError).toHaveBeenCalled();
  });
});

describe('WHATSAPP-002: Formateo de número telefónico', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window = Object.create(window);
    Object.defineProperty(window, 'open', { value: mockWindowOpen });
  });

  it('agrega prefijo 51 para números móviles peruanos (9 dígitos)', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    expect(url).toContain('phone=51987654321');
  });

  it('limpia caracteres no numéricos del teléfono', () => {
    const reserva = { ...reservaPendiente, huesped_telefono: '+51 987-654-321' };
    WhatsAppService.enviarMensajeReserva(reserva, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    expect(url).toContain('phone=51987654321');
  });

  it('mantiene número completo si no es móvil peruano', () => {
    const reserva = { ...reservaPendiente, huesped_telefono: '51987654321' };
    WhatsAppService.enviarMensajeReserva(reserva, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    expect(url).toContain('phone=51987654321');
  });
});

describe('WHATSAPP-003: Generación de mensajes por estado', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window = Object.create(window);
    Object.defineProperty(window, 'open', { value: mockWindowOpen });
  });

  it('genera mensaje de confirmación para reserva pendiente', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    const decodedText = decodeURIComponent(url);

    expect(decodedText).toContain('Gracias por elegir');
    expect(decodedText).toContain('Habitación #101');
    expect(decodedText).toContain('S/ 300.00');
  });

  it('genera mensaje de bienvenida para reserva activa', () => {
    WhatsAppService.enviarMensajeReserva(reservaActiva, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    const decodedText = decodeURIComponent(url);

    expect(decodedText).toContain('disfrutando tu estadía');
    expect(decodedText).toContain('18/07/2026');
  });

  it('genera mensaje de agradecimiento para reserva finalizada', () => {
    WhatsAppService.enviarMensajeReserva(reservaFinalizada, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    const decodedText = decodeURIComponent(url);

    expect(decodedText).toContain('agradecerte');
    expect(decodedText).toContain('W123456');
  });

  it('usa nombre genérico si no hay configuración del hotel', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, {}, context);

    const url = mockWindowOpen.mock.calls[0][0];
    const decodedText = decodeURIComponent(url);

    expect(decodedText).toContain('Nuestro Hospedaje');
  });

  it('abre enlace de WhatsApp en nueva ventana', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      expect.stringContaining('api.whatsapp.com/send'),
      '_blank'
    );
  });

  it('formatea fechas en formato DD/MM/YYYY', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    const url = mockWindowOpen.mock.calls[0][0];
    const decodedText = decodeURIComponent(url);

    expect(decodedText).toContain('15/07/2026');
    expect(decodedText).toContain('18/07/2026');
  });
});

describe('WHATSAPP-004: Auditoría', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window = Object.create(window);
    Object.defineProperty(window, 'open', { value: mockWindowOpen });
  });

  it('registra auditoría cuando se proporciona contexto', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    expect(mockRegistrarLog).toHaveBeenCalledWith({
      hotelId: 'hotel-001',
      user: { id: 'user-123', full_name: 'Recepcionista' },
      accion: 'WHATSAPP_ENVIADO',
      descripcion: expect.stringContaining('Juan Perez'),
      modulo: 'recepcion',
    });
  });

  it('NO registra auditoría si no hay contexto', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, {});

    expect(mockRegistrarLog).not.toHaveBeenCalled();
  });

  it('registra el número de teléfono en la descripción', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    expect(mockRegistrarLog).toHaveBeenCalledWith(
      expect.objectContaining({
        descripcion: expect.stringContaining('987654321'),
      })
    );
  });
});

describe('WHATSAPP-005: Toast de confirmación', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.window = Object.create(window);
    Object.defineProperty(window, 'open', { value: mockWindowOpen });
  });

  it('muestra toast de éxito al enviar mensaje', () => {
    WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Enlace de WhatsApp abierto'
    );
  });

  it('retorna true cuando el envío es exitoso', () => {
    const result = WhatsAppService.enviarMensajeReserva(reservaPendiente, config, context);

    expect(result).toBe(true);
  });
});
