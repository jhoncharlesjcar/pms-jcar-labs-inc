// @ts-nocheck
/**
 * Tests de integración para Caja.jsx — Arqueo, Egresos y Cierre de Turno
 *
 * Verifica el flujo completo de caja: renderizado de estadísticas,
 * lista de egresos y cierres, apertura de modales, interacciones
 * de registro de gastos y confirmación de cierre.
 *
 * @see specs/domain-caja.md
 * @see src/pages/Caja.jsx
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Caja from '@/pages/Caja';

// ─── Variables mock (prefijo 'mock' requerido por hoisting de jest) ────────

let mockAddEgresoMutate = jest.fn();
let mockAddCierreMutate = jest.fn();

// Variable mutable para cambiar egresos entre tests (usada en vez de re-mockear)
let mockEgresosActuales = [
    { id: 'egr-1', monto: 50, concepto: 'Compra de jabón', categoria: 'insumos', fecha: new Date().toISOString(), usuario_id: 'user-1', usuario_nombre: 'Recepcionista Test' },
    { id: 'egr-2', monto: 120, concepto: 'Pago de luz', categoria: 'servicios', fecha: new Date().toISOString(), usuario_id: 'user-1', usuario_nombre: 'Recepcionista Test' },
];

const mockCierres = [
    { id: 'cie-1', fecha: new Date().toISOString(), total_ventas: 1500, total_egresos: 170, saldo_final: 1330, usuario_nombre: 'Recepcionista Test' },
];

const mockStats = {
    ingresos: 1500,
    hotel: 1000,
    pos: 500,
    egresos: 170,
    balance: 1330,
    balanceEfectivo: 830,
    metodos: { efectivo: 1000, yape: 200, plin: 150, tarjeta: 100, transferencia: 50 },
    countHotel: 3,
    countPOS: 5,
    countEgresos: 2,
    hHoy: [],
    pHoy: [],
    egHoy: mockEgresosActuales,
    sunatDeclaradasCount: 4,
    sunatDeclaradasTotal: 1200,
    sunatPendientesCount: 2,
    sunatPendientesTotal: 300,
    sunatRechazadasCount: 0,
    sunatRechazadasTotal: 0,
};

// ─── Mocks de hooks ─────────────────────────────────────────────────────────

jest.mock('@/pages/Caja/hooks/useCajaData', () => ({
    useCajaData: () => ({
        egresos: mockEgresosActuales,
        cierres: mockCierres,
        stats: mockStats,
        addEgreso: { mutate: (...args) => mockAddEgresoMutate(...args), isPending: false },
        addCierre: { mutate: (...args) => mockAddCierreMutate(...args), isPending: false },
    }),
}));

jest.mock('@/pages/Caja/hooks/useCajaExport', () => ({
    useCajaExport: () => ({
        handlePrintTicket: jest.fn(),
        handlePrintHotel: jest.fn(),
        handlePrintPOS: jest.fn(),
        handleExportPDF: jest.fn(),
        handleExportExcel: jest.fn(),
    }),
}));

// ─── Mocks de dependencias externas ─────────────────────────────────────────

jest.mock('@/lib/HotelContext', () => ({
    useHotel: () => ({
        hotelActual: { id: 'hotel-1', nombre: 'Hotel Test', telefono: '987654321' },
    }),
}));

jest.mock('@/lib/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', full_name: 'Recepcionista Test', email: 'test@hotel.com', role: 'recepcionista' },
    }),
}));

jest.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }) => open ? <div data-testid="dialog" data-open={String(open)}>{children}</div> : null,
    DialogContent: ({ children, className }) => <div data-testid="dialog-content" className={className}>{children}</div>,
    DialogHeader: ({ children }) => <div data-testid="dialog-header">{children}</div>,
    DialogTitle: ({ children }) => <div data-testid="dialog-title">{children}</div>,
}));

jest.mock('@/components/ui/button', () => {
    return {
        Button: ({ children, onClick, disabled, variant }) => (
            <button data-testid={`btn-${variant || 'default'}`} onClick={onClick} disabled={disabled}>{children}</button>
        ),
    };
});

jest.mock('@/components/ui/input', () => ({
    Input: (props) => <input data-testid="input" {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
    Label: ({ children, ...props }) => <label data-testid="label" {...props}>{children}</label>,
}));

jest.mock('lucide-react', () => {
    const ReactMock = require('react');
    return {
        Wallet: () => ReactMock.createElement('span', { 'data-testid': 'icon-wallet' }, '👛'),
        TrendingUp: () => ReactMock.createElement('span', { 'data-testid': 'icon-trendup' }, '📈'),
        TrendingDown: () => ReactMock.createElement('span', { 'data-testid': 'icon-trenddown' }, '📉'),
        Landmark: () => ReactMock.createElement('span', { 'data-testid': 'icon-landmark' }, '🏦'),
        FileText: () => ReactMock.createElement('span', { 'data-testid': 'icon-filetext' }, '📄'),
        Plus: () => ReactMock.createElement('span', { 'data-testid': 'icon-plus' }, '+'),
        ArrowRightLeft: () => ReactMock.createElement('span', { 'data-testid': 'icon-arrow' }, '⇄'),
        History: () => ReactMock.createElement('span', { 'data-testid': 'icon-history' }, '📋'),
        MinusCircle: () => ReactMock.createElement('span', { 'data-testid': 'icon-minuscircle' }, '⭕'),
        Calendar: () => ReactMock.createElement('span', { 'data-testid': 'icon-calendar' }, '📅'),
        User: () => ReactMock.createElement('span', { 'data-testid': 'icon-user' }, '👤'),
        AlertCircle: () => ReactMock.createElement('span', { 'data-testid': 'icon-alert' }, '⚠️'),
        CheckCircle2: () => ReactMock.createElement('span', { 'data-testid': 'icon-check' }, '✅'),
        Printer: () => ReactMock.createElement('span', { 'data-testid': 'icon-printer' }, '🖨️'),
        DollarSign: () => ReactMock.createElement('span', { 'data-testid': 'icon-dollar' }, '$'),
        FileSpreadsheet: () => ReactMock.createElement('span', { 'data-testid': 'icon-sheet' }, '📊'),
    };
});

// ─── Configuración ──────────────────────────────────────────────────────────

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
}

function renderWithProviders(ui) {
    return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
    jest.clearAllMocks();
    mockAddEgresoMutate = jest.fn();
    mockAddCierreMutate = jest.fn();
    // Resetear egresos al estado por defecto (con 2 egresos)
    mockEgresosActuales = [
        { id: 'egr-1', monto: 50, concepto: 'Compra de jabón', categoria: 'insumos', fecha: new Date().toISOString(), usuario_id: 'user-1', usuario_nombre: 'Recepcionista Test' },
        { id: 'egr-2', monto: 120, concepto: 'Pago de luz', categoria: 'servicios', fecha: new Date().toISOString(), usuario_id: 'user-1', usuario_nombre: 'Recepcionista Test' },
    ];
    mockStats.egresos = 170;
    mockStats.countEgresos = 2;
    mockStats.egHoy = mockEgresosActuales;
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Caja — Integración Arqueo, Egresos y Cierre', () => {

    it('INT-CAJA-001: Renderiza header "Caja" con descripción', () => {
        renderWithProviders(<Caja />);
        expect(screen.getByText('Caja')).toBeTruthy();
        expect(screen.getByText(/Gestión diaria de flujos de efectivo/)).toBeTruthy();
    });

    it('INT-CAJA-002: Botones Cierre y Egreso visibles', () => {
        renderWithProviders(<Caja />);
        expect(screen.getByText('Cierre')).toBeTruthy();
        expect(screen.getByText('Egreso')).toBeTruthy();
    });

    it('INT-CAJA-003: CajaOverview muestra stats de ingresos, egresos y balance', () => {
        renderWithProviders(<Caja />);
        // toFixed() NO agrega comas: 1500 → "1500.00", no "1,500.00"
        // S/ 1500.00 aparece en Ingresos card y en Cierre card — usar getAllByText
        const ingresosAmounts = screen.getAllByText(/S\/ 1500\.00/);
        expect(ingresosAmounts.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/S\/ 170\.00/)).toBeTruthy();
        const balanceAmounts = screen.getAllByText(/S\/ 1330\.00/);
        expect(balanceAmounts.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/8 transacciones/)).toBeTruthy(); // countHotel + countPOS
        expect(screen.getByText(/2 salidas/)).toBeTruthy(); // countEgresos
    });

    it('INT-CAJA-004: Resumen SUNAT visible con declaradas y pendientes', () => {
        renderWithProviders(<Caja />);
        expect(screen.getByText(/Resumen de Facturación SUNAT/)).toBeTruthy();
        expect(screen.getByText(/S\/ 1200\.00/)).toBeTruthy(); // sunatDeclaradasTotal
        expect(screen.getByText(/S\/ 300\.00/)).toBeTruthy(); // sunatPendientesTotal
    });

    it('INT-CAJA-005: Lista de egresos muestra los egresos mock', () => {
        renderWithProviders(<Caja />);
        expect(screen.getByText('Compra de jabón')).toBeTruthy();
        expect(screen.getByText('Pago de luz')).toBeTruthy();
        expect(screen.getByText(/- S\/ 50\.00/)).toBeTruthy();
        expect(screen.getByText(/- S\/ 120\.00/)).toBeTruthy();
    });

    it('INT-CAJA-006: Lista de cierres muestra el cierre mock', () => {
        renderWithProviders(<Caja />);
        expect(screen.getByText('Cierre de Caja')).toBeTruthy();
        // S/ 1500.00 aparece en Ingresos card y en Cierre card — usar getAllByText
        const amounts = screen.getAllByText(/S\/ 1500\.00/);
        expect(amounts.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Cerrado por Recepcionista Test/)).toBeTruthy();
    });

    it('INT-CAJA-007: EgresoModal se abre al hacer click en Egreso', () => {
        renderWithProviders(<Caja />);
        expect(screen.queryByText(/Nuevo Egreso/)).toBeNull();

        fireEvent.click(screen.getByText('Egreso'));
        expect(screen.getByText(/Nuevo Egreso/)).toBeTruthy();
        expect(screen.getByText(/Registra gastos operativos/)).toBeTruthy();
    });

    it('INT-CAJA-008: CierreModal se abre al hacer click en Cierre', () => {
        renderWithProviders(<Caja />);
        expect(screen.queryByText(/Cierre de Turno/)).toBeNull();

        fireEvent.click(screen.getByText('Cierre'));
        expect(screen.getByText(/Cierre de Turno/)).toBeTruthy();
    });

    it('INT-CAJA-009: CierreModal muestra resumen con stats correctos', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Cierre'));
        expect(screen.getByText(/Ventas Hotel:/)).toBeTruthy();
        expect(screen.getByText(/Ventas Minimarket:/)).toBeTruthy();
        expect(screen.getByText(/SUNAT Declaradas/)).toBeTruthy();
        expect(screen.getByText(/SUNAT Pendientes/)).toBeTruthy();
        expect(screen.getByText(/Efectivo Caja:/)).toBeTruthy();
    });

    it('INT-CAJA-010: CierreModal muestra botones de exportación', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Cierre'));
        expect(screen.getByText('Ventas Hotel')).toBeTruthy();
        expect(screen.getByText('Ventas Minimarket')).toBeTruthy();
        expect(screen.getByText('Reporte PDF')).toBeTruthy();
        expect(screen.getByText('Reporte Excel')).toBeTruthy();
        expect(screen.getByText(/Imprimir Cierre General/)).toBeTruthy();
    });

    it('INT-CAJA-011: EgresoModal: Cancelar cierra el modal', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Egreso'));
        expect(screen.getByText(/Nuevo Egreso/)).toBeTruthy();

        fireEvent.click(screen.getByText('Cancelar'));
        expect(screen.queryByText(/Nuevo Egreso/)).toBeNull();
    });

    it('INT-CAJA-012: CierreModal: Volver cierra el modal', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Cierre'));
        expect(screen.getByText(/Cierre de Turno/)).toBeTruthy();

        fireEvent.click(screen.getByText('Volver'));
        expect(screen.queryByText(/Cierre de Turno/)).toBeNull();
    });

    it('INT-CAJA-013: EgresoModal: Registrar Gasto llama a addEgreso.mutate', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Egreso'));

        // Llenar formulario
        const montoInput = screen.getByPlaceholderText('0.00');
        fireEvent.change(montoInput, { target: { value: '75' } });
        const conceptoInput = screen.getByPlaceholderText('Ej. Compra de insumos de limpieza');
        fireEvent.change(conceptoInput, { target: { value: 'Compra de escobas' } });

        // Seleccionar categoría
        const selectCategoria = screen.getByDisplayValue('Gasto Operativo');
        fireEvent.change(selectCategoria, { target: { value: 'insumos' } });

        // Submit form
        fireEvent.click(screen.getByText('Registrar Gasto'));
        expect(mockAddEgresoMutate).toHaveBeenCalledTimes(1);
    });

    it('INT-CAJA-014: CierreModal: Confirmar Cierre llama a addCierre.mutate', () => {
        renderWithProviders(<Caja />);
        fireEvent.click(screen.getByText('Cierre'));

        fireEvent.click(screen.getByText('Confirmar Cierre'));
        expect(mockAddCierreMutate).toHaveBeenCalledTimes(1);
    });

    it('INT-CAJA-015: Lista de egresos vacía muestra mensaje sin egresos', () => {
        // Mutar la variable mutable para simular egresos vacíos
        mockEgresosActuales.length = 0;
        mockStats.countEgresos = 0;
        mockStats.egresos = 0;

        renderWithProviders(<Caja />);
        expect(screen.getByText(/No se registran egresos recientes/)).toBeTruthy();
    });

});
