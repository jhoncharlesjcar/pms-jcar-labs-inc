// @ts-nocheck
// tests/recepcion.test.tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Recepcion from "@/pages/Recepcion";

// Mockear módulos que usan import.meta.env (Vite-specific — Jest no lo soporta)
jest.mock('@/api/facturacion', () => ({
    crearComprobante: jest.fn(),
}));
jest.mock('@/lib/exportMincetur', () => ({
    exportarFichaMincetur: jest.fn(),
}));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
    },
});

function renderWithProviders(ui) {
    return render(
        <QueryClientProvider client={queryClient}>
            {ui}
        </QueryClientProvider>
    );
}

describe('Recepcion Page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the page title', () => {
        renderWithProviders(<Recepcion />);
        const title = screen.getByRole('heading', { name: /recepción/i });
        expect(title).toBeInTheDocument();
    });
});
