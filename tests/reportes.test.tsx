// @ts-nocheck
// tests/reportes.test.tsx
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Reportes from "@/pages/Reportes";

// Mockear @/api/facturacion para evitar error import.meta.env
jest.mock('@/api/facturacion', () => ({
    crearComprobante: jest.fn(),
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

describe('Reportes Page', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the page title', () => {
        renderWithProviders(<Reportes />);
        const title = screen.getByRole('heading', { name: /reportes/i });
        expect(title).toBeInTheDocument();
    });
});
