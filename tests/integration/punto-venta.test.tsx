// @ts-nocheck
/**
 * Tests de integración para PuntoVenta.jsx — POS Minimarket
 *
 * Verifica el flujo completo del Punto de Venta:
 * renderizado del catálogo, agregar/quitar productos del carrito,
 * cálculo de totales, botón Cobrar, modal de pago, y navegación móvil.
 *
 * @see specs/domain-ventas.md
 * @see src/pages/PuntoVenta.jsx
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PuntoVenta from '@/pages/PuntoVenta';

// ─── Variables mock (prefijo 'mock' requerido por hoisting de jest) ────────

// Productos mock para el catálogo
const mockGaseosa = { id: 'prod-1', nombre: 'Gaseosa 500ml', precio_venta: 3.50, precio: 3.50, stock: 50, categoria: 'bebidas', emoji: '🥤', activo: true };
const mockPapas = { id: 'prod-2', nombre: 'Papas Fritas', precio_venta: 2.00, precio: 2.00, stock: 30, categoria: 'snacks', emoji: '🍿', activo: true };
const mockAgua = { id: 'prod-3', nombre: 'Agua Mineral', precio_venta: 1.50, precio: 1.50, stock: 20, categoria: 'bebidas', emoji: '🥤', activo: true };

// ─── Mocks de dependencias externas ─────────────────────────────────────────

jest.mock('@/components/pos/CatalogoMinimarket', () => {
    return function MockCatalogoMinimarket({ onAgregar, itemsEnCarrito }) {
        return (
            <div data-testid="catalogo-minimarket">
                <p data-testid="catalogo-items-count">{itemsEnCarrito.length} en carrito</p>
                <button data-testid="prod-gaseosa" onClick={() => onAgregar({ ...mockGaseosa })}>
                    {mockGaseosa.nombre} - S/ {mockGaseosa.precio.toFixed(2)}
                </button>
                <button data-testid="prod-papas" onClick={() => onAgregar({ ...mockPapas })}>
                    {mockPapas.nombre} - S/ {mockPapas.precio.toFixed(2)}
                </button>
                <button data-testid="prod-agua" onClick={() => onAgregar({ ...mockAgua })}>
                    {mockAgua.nombre} - S/ {mockAgua.precio.toFixed(2)}
                </button>
            </div>
        );
    };
});

jest.mock('@/components/pos/PagoModal', () => {
    return function MockPagoModal({ open, onClose, resumen, onExito }) {
        if (!open) return null;
        return (
            <div data-testid="pago-modal" data-total={resumen.total} data-items={resumen.items.length}>
                <p>Confirmar Cobro</p>
                <p data-testid="pago-total">S/ {resumen.total.toFixed(2)}</p>
                <p data-testid="pago-items">{resumen.items.length} producto(s)</p>
                <button data-testid="pago-cerrar" onClick={onClose}>Cerrar</button>
                <button data-testid="pago-completar" onClick={() => { onExito(); onClose(); }}>Completar</button>
            </div>
        );
    };
});

jest.mock('@/components/ui/button', () => {
    return {
        Button: ({ children, onClick, disabled, variant, className }) => (
            <button data-testid={`btn-${variant || 'default'}`} onClick={onClick} disabled={disabled} className={className}>{children}</button>
        ),
    };
});

jest.mock('lucide-react', () => {
    const ReactMock = require('react');
    return {
        ShoppingCart: () => ReactMock.createElement('span', { 'data-testid': 'icon-cart' }, '🛒'),
        Store: () => ReactMock.createElement('span', { 'data-testid': 'icon-store' }, '🏪'),
        Receipt: () => ReactMock.createElement('span', { 'data-testid': 'icon-receipt' }, '🧾'),
        RotateCcw: () => ReactMock.createElement('span', { 'data-testid': 'icon-rotate' }, '↺'),
        Minus: () => ReactMock.createElement('span', { 'data-testid': 'icon-minus' }, '−'),
        Plus: () => ReactMock.createElement('span', { 'data-testid': 'icon-plus' }, '+'),
        Trash2: () => ReactMock.createElement('span', { 'data-testid': 'icon-trash' }, '🗑️'),
        ShoppingBag: () => ReactMock.createElement('span', { 'data-testid': 'icon-bag' }, '🛍️'),
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
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PuntoVenta — Integración POS Minimarket', () => {

    it('INT-POS-001: Renderiza header del Minimarket', () => {
        renderWithProviders(<PuntoVenta />);
        expect(screen.getByText(/Minimarket/)).toBeTruthy();
    });

    it('INT-POS-002: Catálogo mock con 3 productos visibles', () => {
        renderWithProviders(<PuntoVenta />);
        expect(screen.getByTestId('catalogo-minimarket')).toBeTruthy();
        expect(screen.getByTestId('prod-gaseosa')).toBeTruthy();
        expect(screen.getByTestId('prod-papas')).toBeTruthy();
        expect(screen.getByTestId('prod-agua')).toBeTruthy();
    });

    it('INT-POS-003: Carrito vacío muestra estado vacío y botón deshabilitado', () => {
        renderWithProviders(<PuntoVenta />);
        // El texto "Carrito vacío" aparece tanto en el estado vacío como en el botón deshabilitado
        const emptyTexts = screen.getAllByText(/Carrito vacío/);
        expect(emptyTexts.length).toBeGreaterThanOrEqual(2);
        // El botón principal muestra "Carrito vacío" y está deshabilitado
        const disabledBtn = screen.getByRole('button', { name: /Carrito vacío/ });
        expect(disabledBtn).toBeDisabled();
    });

    it('INT-POS-004: Agregar producto aparece en carrito con cantidad 1', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        // El carrito ahora muestra el producto
        expect(screen.getByText(mockGaseosa.nombre)).toBeTruthy();
        // El total S/ 3.50 aparece en subtotal, total y botón
        const amounts = screen.getAllByText(/S\/ 3\.50/);
        expect(amounts.length).toBeGreaterThanOrEqual(2);
    });

    it('INT-POS-005: Agregar mismo producto incrementa cantidad a 2', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));
        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        // Cantidad 2 → total S/ 7.00 (aparece en subtotal + total + botón)
        const amounts = screen.getAllByText(/S\/ 7\.00/);
        expect(amounts.length).toBeGreaterThanOrEqual(2);
    });

    it('INT-POS-006: Agregar productos diferentes muestra ambos en carrito', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));
        fireEvent.click(screen.getByTestId('prod-papas'));

        // Ambos nombres visibles
        expect(screen.getByText(mockGaseosa.nombre)).toBeTruthy();
        expect(screen.getByText(mockPapas.nombre)).toBeTruthy();
        // Total = 3.50 + 2.00 = 5.50 (aparece en subtotal + total + botón)
        const amounts = screen.getAllByText(/S\/ 5\.50/);
        expect(amounts.length).toBeGreaterThanOrEqual(2);
    });

    it('INT-POS-007: Botón Cobrar se habilita con productos en carrito', () => {
        renderWithProviders(<PuntoVenta />);
        // Sin items, el botón muestra "Carrito vacío" - no hay "Cobrar" visible
        expect(screen.queryByText(/Cobrar S\//)).toBeNull();

        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        // Con items, aparece "Cobrar S/ X.XX" en el botón principal
        const cobrarBtn = screen.getByText(/Cobrar S\/ 3\.50/);
        expect(cobrarBtn).toBeTruthy();
        // El botón está dentro de un <button>
        const btnElement = cobrarBtn.closest('button');
        expect(btnElement).not.toBeDisabled();
    });

    it('INT-POS-008: Total en botón Cobrar se actualiza con múltiples productos', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa')); // 3.50
        fireEvent.click(screen.getByTestId('prod-papas'));    // +2.00 = 5.50
        fireEvent.click(screen.getByTestId('prod-agua'));     // +1.50 = 7.00

        expect(screen.getByText(/Cobrar S\/ 7\.00/)).toBeTruthy();
    });

    it('INT-POS-009: Total visible en el sidebar del carrito', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa')); // 3.50

        // El total aparece en el panel derecho y en el botón Cobrar
        const totals = screen.getAllByText(/S\/ 3\.50/);
        expect(totals.length).toBeGreaterThanOrEqual(2);
    });

    it('INT-POS-010: Botón Limpiar resetea el carrito', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));
        fireEvent.click(screen.getByTestId('prod-papas'));

        expect(screen.getByText(mockGaseosa.nombre)).toBeTruthy();
        expect(screen.getByText(mockPapas.nombre)).toBeTruthy();

        // Click en Limpiar
        fireEvent.click(screen.getByText(/Limpiar/));

        // Vuelve a estado vacío — "Carrito vacío" aparece dos veces (estado + botón)
        const emptyTexts = screen.getAllByText(/Carrito vacío/);
        expect(emptyTexts.length).toBeGreaterThanOrEqual(2);
        // No hay "Cobrar S/" visible
        expect(screen.queryByText(/Cobrar S\//)).toBeNull();
    });

    it('INT-POS-011: PagoModal se abre al hacer click en Cobrar', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        expect(screen.queryByTestId('pago-modal')).toBeNull();

        // Click en el texto "Cobrar S/ 3.50" del botón principal
        fireEvent.click(screen.getByText(/Cobrar S\/ 3\.50/));

        expect(screen.getByTestId('pago-modal')).toBeTruthy();
    });

    it('INT-POS-012: PagoModal recibe resumen correcto (total e items)', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa')); // 3.50
        fireEvent.click(screen.getByTestId('prod-papas'));    // +2.00

        fireEvent.click(screen.getByText(/Cobrar S\/ 5\.50/));

        const modal = screen.getByTestId('pago-modal');
        expect(modal.dataset.total).toBe('5.5');
        expect(modal.dataset.items).toBe('2');
        expect(screen.getByTestId('pago-total').textContent).toBe('S/ 5.50');
        expect(screen.getByTestId('pago-items').textContent).toBe('2 producto(s)');
    });

    it('INT-POS-013: Cerrar PagoModal sin completar no limpia carrito', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        fireEvent.click(screen.getByText(/Cobrar S\/ 3\.50/));
        expect(screen.getByTestId('pago-modal')).toBeTruthy();

        // Cerrar sin completar
        fireEvent.click(screen.getByTestId('pago-cerrar'));
        expect(screen.queryByTestId('pago-modal')).toBeNull();

        // Carrito sigue con productos
        expect(screen.getByText(mockGaseosa.nombre)).toBeTruthy();
    });

    it('INT-POS-014: Completar pago en PagoModal limpia carrito y cierra modal', () => {
        renderWithProviders(<PuntoVenta />);
        fireEvent.click(screen.getByTestId('prod-gaseosa'));
        fireEvent.click(screen.getByTestId('prod-papas'));

        fireEvent.click(screen.getByText(/Cobrar S\/ 5\.50/));
        expect(screen.getByTestId('pago-modal')).toBeTruthy();

        // Completar pago
        fireEvent.click(screen.getByTestId('pago-completar'));

        // Modal cerrado
        expect(screen.queryByTestId('pago-modal')).toBeNull();

        // Carrito vacío — "Carrito vacío" aparece dos veces
        const emptyTexts = screen.getAllByText(/Carrito vacío/);
        expect(emptyTexts.length).toBeGreaterThanOrEqual(2);
        // No hay "Cobrar S/" visible
        expect(screen.queryByText(/Cobrar S\//)).toBeNull();
    });

    it('INT-POS-015: Navegación móvil toggle entre catálogo y carrito', () => {
        renderWithProviders(<PuntoVenta />);

        // Agregar producto para que los botones móviles se rendericen
        fireEvent.click(screen.getByTestId('prod-gaseosa'));

        // Verificar que existe el botón de volver a catálogo (solo visible en mobile)
        expect(screen.getByText(/← Catálogo/)).toBeTruthy();

        // Los botones de navegación móvil están presentes
        expect(screen.getByText(/Productos/)).toBeTruthy();
        // "Carrito" aparece en sidebar y en nav móvil
        const carritoTexts = screen.getAllByText(/^Carrito$/);
        expect(carritoTexts.length).toBeGreaterThanOrEqual(2);
    });

});
