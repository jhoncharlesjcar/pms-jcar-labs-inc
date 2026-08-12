// @ts-nocheck
/**
 * Tests de integración para RegistrarVentaModal.jsx
 *
 * Verifica el flujo completo de UI del modal de registro de cobro:
 * renderizado, estados del formulario, toggle de comprobante SUNAT,
 * cálculo de totales con descuento, e interacciones principales.
 *
 * @see specs/domain-checkout.md
 * @see src/components/RegistrarVentaModal.jsx
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RegistrarVentaModal from '@/components/RegistrarVentaModal';

// ─── Variables mock (prefijo 'mock' permitido en jest.mock) ─────────────────────

const mockDbCreate = jest.fn();
const mockDbUpdate = jest.fn();

// Variable mutable para mockear useCheckout en diferentes estados
let mockUseCheckout = jest.fn().mockReturnValue({
    registrarPago: { mutate: jest.fn() },
    isPending: false,
    ventaCreada: null,
});

// Variable para el onValueChange del Select (manejo de clicks en SelectItem)
// Prefijo 'mock' requerido para que jest.mock() pueda referenciarla
let mockSelectOnValueChange = null;

// ─── Mocks de dependencias externas ─────────────────────────────────────────────

jest.mock('@/hooks/useCheckout', () => ({
    useCheckout: (...args) => mockUseCheckout(...args),
}));

jest.mock('@/api/db', () => ({
    db: {
        entities: {
            ConfigHotel: {
                filter: jest.fn().mockResolvedValue([{
                    id: 'hotel-1',
                    modo_sunat: 'manual',
                    aplica_igv: true,
                    nombre: 'Hotel Test',
                    ruc: '20123456789',
                    direccion: 'Av. Test 123',
                    telefono: '987654321',
                    mensaje_ticket: '¡Gracias!',
                }]),
            },
            Venta: { create: (...args) => mockDbCreate(...args) },
            Reserva: { update: (...args) => mockDbUpdate(...args) },
            Habitacion: { update: (...args) => mockDbUpdate(...args) },
        },
        forHotel: jest.fn().mockReturnValue({}),
    },
}));

jest.mock('@/api/facturacion', () => ({
    crearComprobante: jest.fn().mockResolvedValue({ estado: 'Aceptado', id: 'sunat-1' }),
}));

jest.mock('@/lib/auditLogger', () => ({
    registrarLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', full_name: 'Recepcionista Test', email: 'test@hotel.com', role: 'recepcionista' },
    }),
}));

jest.mock('@/lib/HotelContext', () => ({
    useHotel: () => ({
        hotelActual: { id: 'hotel-1', nombre: 'Hotel Test', telefono: '987654321' },
    }),
}));

jest.mock('@/components/TicketPDF', () => {
    return function MockTicketPDF({ venta, config }) {
        return <div data-testid="ticket-pdf" data-total={venta.total} data-ticket={venta.numero_ticket}>
            TicketPDF Preview: S/ {venta.total?.toFixed(2)}
        </div>;
    };
});

jest.mock('@/components/PaymentIcons', () => ({
    YapeIcon: () => <span data-testid="yape-icon">YapeIcon</span>,
    PlinIcon: () => <span data-testid="plin-icon">PlinIcon</span>,
    EfectivoIcon: () => <span data-testid="efectivo-icon">EfectivoIcon</span>,
    TarjetaIcon: () => <span data-testid="tarjeta-icon">TarjetaIcon</span>,
}));

// Mocks de shadcn/ui
jest.mock('@/components/ui/sheet', () => ({
    Sheet: ({ children, open }) => <div data-testid="sheet" data-open={open}>{children}</div>,
    SheetContent: ({ children, side, className }) => <div data-testid="sheet-content" data-side={side} className={className}>{children}</div>,
    SheetHeader: ({ children }) => <div data-testid="sheet-header">{children}</div>,
    SheetTitle: ({ children }) => <div data-testid="sheet-title">{children}</div>,
}));

jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }) => <div data-testid="dialog" data-open={open}>{children}</div>,
    DialogContent: ({ children, className }) => <div data-testid="dialog-content" className={className}>{children}</div>,
    DialogHeader: ({ children }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children }) => <div data-testid="dialog-title">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
    Button: ({ children, onClick, disabled, variant, className }) => (
        <button data-testid={`btn-${variant || 'default'}`} onClick={onClick} disabled={disabled} className={className}>{children}</button>
    ),
}));

jest.mock('@/components/ui/input', () => ({
    Input: (props) => <input data-testid="input" {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
    Label: ({ children, className }) => <label data-testid="label" className={className}>{children}</label>,
}));

jest.mock('@/components/ui/select', () => ({
    Select: ({ children, onValueChange, value }) => {
        mockSelectOnValueChange = onValueChange;
        return <div data-testid="select" data-value={value}>{children}</div>;
    },
    SelectTrigger: ({ children, className }) => <button data-testid="select-trigger" className={className}>{children}</button>,
    SelectValue: () => <span data-testid="select-value" />,
    SelectContent: ({ children }) => <div data-testid="select-content">{children}</div>,
    SelectItem: ({ children, value, className }) => (
        <button data-testid="select-item" data-value={value} className={className}
            onClick={(e) => { e.preventDefault(); mockSelectOnValueChange?.(value); }}
        >{children}</button>
    ),
}));

jest.mock('lucide-react', () => ({
    CheckCircle: () => <span data-testid="check-circle">✅</span>,
    ExternalLink: ({ children }) => <span data-testid="external-link">{children}</span>,
    Printer: () => <span data-testid="printer-icon">🖨️</span>,
    Share2: () => <span data-testid="share-icon">📤</span>,
}));

jest.mock('sonner', () => ({
    toast: { success: jest.fn(), error: jest.fn() },
}));

// ─── Configuración ──────────────────────────────────────────────────────────────

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
}

function renderWithProviders(ui) {
    return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

// ─── Datos de prueba ────────────────────────────────────────────────────────────

const reservaMock = {
    id: 'res-1', numero_reserva: 'R-001', huesped_nombre: 'Juan Pérez',
    huesped_dni: '12345678', habitacion_id: 'hab-1', habitacion_numero: '101',
    habitacion_tipo: 'simple', fecha_entrada: '2026-07-14', fecha_salida: '2026-07-16',
    noches: 2, precio_noche: 100, total: 200,
};

const ventaExitosa = {
    id: 'venta-1', numero_ticket: 'T001234', total: 200, metodo_pago: 'efectivo',
    estado_comprobante: 'ticket_interno', tipo_comprobante: 'ninguno',
    huesped_nombre: 'Juan Pérez', huesped_dni: '12345678',
    habitacion_numero: '101', habitacion_tipo: 'simple',
    noches: 2, precio_noche: 100, fecha_entrada: '2026-07-14', fecha_salida: '2026-07-16',
    descuento: 0, notas: '',
};

const onCloseMock = jest.fn();
const onSuccessMock = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    mockDbCreate.mockReset().mockResolvedValue({ ...ventaExitosa });
    mockDbUpdate.mockReset();
    onCloseMock.mockReset();
    onSuccessMock.mockReset();
    mockSelectOnValueChange = null;
    // Resetear el mock de useCheckout al estado por defecto
    mockUseCheckout.mockReturnValue({
        registrarPago: { mutate: jest.fn() },
        isPending: false,
        ventaCreada: null,
    });
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('RegistrarVentaModal — Integración UI', () => {

    it('INT-001: Renderiza con datos de la reserva', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => {
            expect(screen.getByText(/Registrar Cobro/)).toBeTruthy();
            expect(screen.getByText(/Hab. #101/)).toBeTruthy();
            expect(screen.getByText(/Juan Pérez/)).toBeTruthy();
        });
    });

    it('INT-002: Muestra total correcto: S/ 200 (100 × 2 noches)', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => {
            // El total aparece en dos lugares: resumen + TOTAL A COBRAR
            const totals = screen.getAllByText(/S\/ 200\.00/);
            expect(totals.length).toBeGreaterThanOrEqual(2);
        });
    });

    it('INT-003: Descuento actualiza el total en tiempo real', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => {
            const totals = screen.getAllByText(/S\/ 200\.00/);
            expect(totals.length).toBeGreaterThanOrEqual(2);
        });

        // Primer input = descuento
        const inputs = screen.getAllByTestId('input');
        fireEvent.change(inputs[0], { target: { value: '50' } });

        await waitFor(() => expect(screen.getByText(/S\/ 150\.00/)).toBeTruthy());
    });

    it('INT-004: Línea de descuento visible solo cuando > 0', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        // La línea de descuento (con monto negativo) NO debe aparecer cuando descuento = 0
        await waitFor(() => expect(screen.queryByText(/-S\/ 30\.00/)).toBeNull());

        // Primer input = descuento
        const inputs = screen.getAllByTestId('input');
        fireEvent.change(inputs[0], { target: { value: '30' } });

        await waitFor(() => {
            expect(screen.getByText(/-S\/ 30\.00/)).toBeTruthy();
        });
    });

    it('INT-005: Toggle SUNAT muestra/oculta formulario de comprobante', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => expect(screen.queryByText(/Tipo de comprobante/)).toBeNull());

        // Click en "Sí — Emitir en SUNAT"
        fireEvent.click(screen.getByText(/Sí — Emitir en SUNAT/));
        await waitFor(() => {
            expect(screen.getByText(/Tipo de comprobante/)).toBeTruthy();
            expect(screen.getByText(/Boleta de Venta/)).toBeTruthy();
        });

        // Click en "No — Ticket rápido" para ocultar
        fireEvent.click(screen.getByText(/^No — Ticket rápido/));
        await waitFor(() => expect(screen.queryByText(/Tipo de comprobante/)).toBeNull());
    });

    it('INT-006: Boleta muestra DNI + nombre, DNI precargado de la reserva', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        fireEvent.click(screen.getByText(/Sí — Emitir en SUNAT/));

        await waitFor(() => {
            expect(screen.getByText(/DNI \/ Documento del cliente/)).toBeTruthy();
            expect(screen.getByText(/Nombre completo/)).toBeTruthy();
            const dniInput = screen.getAllByTestId('input').find(i => i.value === '12345678');
            expect(dniInput).toBeTruthy();
        });
    });

    it('INT-007: Factura muestra RUC + Razón Social (sin precarga)', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        fireEvent.click(screen.getByText(/Sí — Emitir en SUNAT/));

        // Click en "Factura" en el SelectItem — el mock conecta onValueChange
        await waitFor(() => {
            const facturaItem = screen.getByText('Factura');
            fireEvent.click(facturaItem);
        });

        await waitFor(() => {
            expect(screen.getByText(/RUC del cliente/)).toBeTruthy();
            expect(screen.getByText(/Razón social/)).toBeTruthy();
            // No debe tener el DNI precargado (es factura, no boleta)
            expect(screen.getAllByTestId('input').find(i => i.value === '12345678')).toBeUndefined();
        });
    });

    it('INT-008: Cancelar llama a onClose', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => {
            fireEvent.click(screen.getByText(/Cancelar/));
            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });
    });

    it('INT-009: Botón Registrar Pago presente', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => expect(screen.getByText(/Registrar Pago/)).toBeTruthy());
    });

    it('INT-010: IGV y Base imponible visibles en resumen', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );
        await waitFor(() => {
            expect(screen.getByText(/IGV/)).toBeTruthy();
            expect(screen.getByText(/Base imponible/)).toBeTruthy();
        });
    });

    it('INT-011: Modo manual muestra texto de portal SUNAT al activar comprobante', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );

        await waitFor(() => {
            expect(screen.queryByText(/se generará y enviará el comprobante/)).toBeNull();
            fireEvent.click(screen.getByText(/Sí/));
        });

        await waitFor(() => expect(screen.getByText(/portal de SUNAT/)).toBeTruthy());
    });

    it('INT-012: Yape/Plin muestra QR y campo de referencia', async () => {
        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );

        // Cambiar método de pago a Yape
        await waitFor(() => {
            const yapeItem = screen.getByText('Yape');
            fireEvent.click(yapeItem);
        });

        await waitFor(() => {
            expect(screen.getByText(/Pago Móvil \(YAPE\)/)).toBeTruthy();
            expect(screen.getByText(/Código de Operación \/ Referencia/)).toBeTruthy();
            expect(screen.getByPlaceholderText('Ej: 897654')).toBeTruthy();
        });
    });

    it('INT-013: Éxito (ventaCreada) muestra diálogo con resumen del pago', async () => {
        // Simular que el hook devuelve ventaCreada (estado de éxito)
        mockUseCheckout.mockReturnValue({
            registrarPago: { mutate: jest.fn() },
            isPending: false,
            ventaCreada: { ...ventaExitosa },
        });

        renderWithProviders(
            <RegistrarVentaModal reserva={reservaMock} onClose={onCloseMock} onSuccess={onSuccessMock} />
        );

        await waitFor(() => {
            // Debe mostrar el diálogo de éxito con Pago Registrado
            expect(screen.getByText(/Pago Registrado/)).toBeTruthy();
            // S/ 200.00 aparece en el total y dentro del TicketPDF
            const totals = screen.getAllByText(/S\/ 200\.00/);
            expect(totals.length).toBeGreaterThanOrEqual(2);
            // Mock de TicketPDF renderiza "TicketPDF Preview" (sin espacio)
            expect(screen.getByText(/TicketPDF/)).toBeTruthy();
            expect(screen.getByText(/Cerrar/)).toBeTruthy();
        });
    });
});
