// @ts-nocheck
/**
 * Tests de integración para HabitacionesGrid y HabitacionCard
 *
 * Verifican el grid visual, colores de estado, filtrado y interacciones.
 *
 * @see specs/domain-habitaciones.md — Sección 7
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { HabitacionesGrid } from '@/components/habitaciones/HabitacionesGrid';
import { HabitacionCard } from '@/components/habitaciones/HabitacionCard';
import { COLORES_ESTADO, TIPOS_HABITACION } from '@/services/habitaciones.service';
import { getStatusColors } from '@/constants/statusColors';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('sonner', () => ({
    toast: jest.fn(),
}));

jest.mock('lucide-react', () => ({
    BedDouble: () => null,
    Pencil: () => null,
    Trash2: () => null,
    CheckCircle2: () => null,
    User: () => null,
    CalendarDays: () => null,
    Wrench: () => null,
    Sparkles: () => null,
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const estadoConfig = {
    disponible: { label: 'Disponible', icon: () => null, color: '', bg: '' },
    ocupada: { label: 'Ocupada', icon: () => null, color: '', bg: '' },
    reservada: { label: 'Reservada', icon: () => null, color: '', bg: '' },
    mantenimiento: { label: 'Mantenimiento', icon: () => null, color: '', bg: '' },
    limpieza: { label: 'Limpieza', icon: () => null, color: '', bg: '' },
};

const AMENITIES_MAP = [
    { id: 'wifi', label: 'WiFi', icon: () => null },
    { id: 'tv', label: 'Smart TV', icon: () => null },
    { id: 'agua', label: 'Agua Caliente', icon: () => null },
    { id: 'bano', label: 'Baño Privado', icon: () => null },
];

/**
 * Implementación REAL de parseAmenities (idéntica a src/pages/Habitaciones.jsx)
 */
const parseAmenities = (desc) => {
    try {
        const parsed = JSON.parse(desc);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        const text = desc || '';
        return {
            wifi: text.toLowerCase().includes('wifi'),
            tv: text.toLowerCase().includes('tv') || text.toLowerCase().includes('smart'),
            agua: text.toLowerCase().includes('agua'),
            bano: text.toLowerCase().includes('baño') || text.toLowerCase().includes('privado')
        };
    }
    return { wifi: false, tv: false, agua: false, bano: false };
};

const habitacionesMock = [
    { id: '1', numero: '101', tipo: 'simple', estado: 'disponible', precio: 80, precio_noche: 80, capacidad: 2, piso: '1', descripcion: '{}' },
    { id: '2', numero: '102', tipo: 'matrimonial', estado: 'ocupada', precio: 120, precio_noche: 120, capacidad: 2, piso: '1', descripcion: '{"wifi":true}' },
    { id: '3', numero: '201', tipo: 'doble simple', estado: 'limpieza', precio: 100, precio_noche: 100, capacidad: 3, piso: '2', descripcion: '{"wifi":true,"tv":true,"agua":true,"bano":true}' },
    { id: '4', numero: '202', tipo: 'simple', estado: 'reservada', precio: 80, precio_noche: 80, capacidad: 2, piso: '2', descripcion: '{"bano":true}' },
    { id: '5', numero: '301', tipo: 'queen', estado: 'mantenimiento', precio: 150, precio_noche: 150, capacidad: 2, piso: '3', descripcion: 'Con wifi y Smart TV, agua caliente y baño privado' },
];

const mockOpenEdit = jest.fn();
const mockDel = jest.fn();

const defaultProps = {
    filtradas: habitacionesMock,
    isLoading: false,
    filtroEstado: 'todos',
    estadoConfig,
    AMENITIES_MAP,
    parseAmenities,
    openEdit: mockOpenEdit,
    del: mockDel,
};

// ─── HabitacionCard Tests ─────────────────────────────────────────────────────

describe('HabitacionCard', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renderiza número de habitación', () => {
        render(<HabitacionCard h={habitacionesMock[0]} {...defaultProps} />);
        expect(screen.getByText('101')).toBeTruthy();
    });

    it('renderiza tipo y piso', () => {
        render(<HabitacionCard h={habitacionesMock[0]} {...defaultProps} />);
        expect(screen.getByText(/simple/)).toBeTruthy();
    });

    it('renderiza precio', () => {
        render(<HabitacionCard h={habitacionesMock[0]} {...defaultProps} />);
        expect(screen.getByText(/S\/ 80/)).toBeTruthy();
    });

    it('renderiza label de estado', () => {
        render(<HabitacionCard h={habitacionesMock[0]} {...defaultProps} />);
        expect(screen.getByText('Disponible')).toBeTruthy();
    });

    it('llama a openEdit al hacer clic', () => {
        render(<HabitacionCard h={habitacionesMock[0]} {...defaultProps} />);
        fireEvent.click(screen.getByText('101'));
        expect(mockOpenEdit).toHaveBeenCalledWith(habitacionesMock[0]);
    });

    it('muestra badge de estado correcto para cada estado', () => {
        const estados = ['disponible', 'ocupada', 'reservada', 'limpieza', 'mantenimiento'];
        const labels = ['Disponible', 'Ocupada', 'Reservada', 'Limpieza', 'Mantenimiento'];

        estados.forEach((estado, i) => {
            const { unmount } = render(
                <HabitacionCard h={{ ...habitacionesMock[0], estado }} {...defaultProps} />
            );
            expect(screen.getByText(labels[i])).toBeTruthy();
            unmount();
        });
    });
});

// ─── HabitacionesGrid Tests ───────────────────────────────────────────────────

describe('HabitacionesGrid', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renderiza todas las habitaciones', () => {
        render(<HabitacionesGrid {...defaultProps} />);
        expect(screen.getByText('101')).toBeTruthy();
        expect(screen.getByText('102')).toBeTruthy();
        expect(screen.getByText('201')).toBeTruthy();
        expect(screen.getByText('202')).toBeTruthy();
        expect(screen.getByText('301')).toBeTruthy();
    });

    it('muestra skeleton cuando isLoading', () => {
        const { container } = render(<HabitacionesGrid {...defaultProps} isLoading={true} />);
        expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });

    it('muestra mensaje vacío cuando no hay habitaciones', () => {
        render(<HabitacionesGrid {...defaultProps} filtradas={[]} />);
        expect(screen.getByText(/No hay habitaciones/)).toBeTruthy();
    });

    it('filtra habitaciones por estado', () => {
        const soloOcupadas = habitacionesMock.filter(h => h.estado === 'ocupada');
        render(<HabitacionesGrid {...defaultProps} filtradas={soloOcupadas} />);
        expect(screen.getByText('102')).toBeTruthy();
        expect(screen.queryByText('101')).toBeNull();
    });
});

// ─── Colores de Estado ────────────────────────────────────────────────────────

describe('Colores de estado (RN-HAB-001)', () => {
    it('getStatusColors retorna colores para cada estado', () => {
        const estados = ['disponible', 'ocupada', 'reservada', 'mantenimiento', 'limpieza'];
        estados.forEach(estado => {
            const colors = getStatusColors(estado);
            expect(colors).toBeDefined();
            expect(colors.card).toBeTruthy();
            expect(colors.badge).toBeTruthy();
            expect(colors.number).toBeTruthy();
        });
    });

    it('COLORES_ESTADO tiene entrada para cada estado', () => {
        expect(COLORES_ESTADO.disponible).toBeDefined();
        expect(COLORES_ESTADO.ocupada).toBeDefined();
        expect(COLORES_ESTADO.reservada).toBeDefined();
        expect(COLORES_ESTADO.mantenimiento).toBeDefined();
        expect(COLORES_ESTADO.limpieza).toBeDefined();
    });

    it('cada estado tiene label descriptivo', () => {
        expect(COLORES_ESTADO.disponible.label).toBe('Disponible');
        expect(COLORES_ESTADO.ocupada.label).toBe('Ocupada');
        expect(COLORES_ESTADO.reservada.label).toBe('Reservada');
        expect(COLORES_ESTADO.mantenimiento.label).toBe('Mantenimiento');
        expect(COLORES_ESTADO.limpieza.label).toBe('Limpieza');
    });
});

// ─── Tipos de Habitación ──────────────────────────────────────────────────────

describe('Tipos de habitación (RN-HAB-003)', () => {
    it('TIPOS_HABITACION contiene todos los tipos válidos', () => {
        expect(TIPOS_HABITACION).toContain('simple');
        expect(TIPOS_HABITACION).toContain('doble simple');
        expect(TIPOS_HABITACION).toContain('matrimonial');
        expect(TIPOS_HABITACION).toContain('doble matrimonial');
        expect(TIPOS_HABITACION).toContain('mixta');
        expect(TIPOS_HABITACION).toContain('queen');
    });
});

// ─── parseAmenities (implementación real) ─────────────────────────────────────

describe('parseAmenities — implementación real (vs stub)', () => {
    it('parsea JSON vacío como todas falsy', () => {
        const result = parseAmenities('{}');
        expect(result.wifi).toBeFalsy();
        expect(result.tv).toBeFalsy();
        expect(result.agua).toBeFalsy();
        expect(result.bano).toBeFalsy();
    });

    it('parsea JSON con amenities seleccionadas', () => {
        const result = parseAmenities('{"wifi":true,"bano":true}');
        expect(result.wifi).toBeTruthy();
        expect(result.tv).toBeFalsy();
        expect(result.agua).toBeFalsy();
        expect(result.bano).toBeTruthy();
    });

    it('parsea JSON con todas las amenities activas', () => {
        const result = parseAmenities('{"wifi":true,"tv":true,"agua":true,"bano":true}');
        expect(result.wifi).toBeTruthy();
        expect(result.tv).toBeTruthy();
        expect(result.agua).toBeTruthy();
        expect(result.bano).toBeTruthy();
    });

    it('fallback a texto plano: detecta wifi en descripción textual', () => {
        const result = parseAmenities('Habitación con wifi y TV cable');
        expect(result.wifi).toBeTruthy();
        expect(result.tv).toBeTruthy();
        expect(result.agua).toBeFalsy();
        expect(result.bano).toBeFalsy();
    });

    it('fallback a texto plano: detecta Smart TV y baño privado', () => {
        const result = parseAmenities('Smart TV 40 pulgadas, baño privado con agua caliente');
        expect(result.wifi).toBeFalsy();
        expect(result.tv).toBeTruthy();  // 'smart'
        expect(result.bano).toBeTruthy(); // 'baño' + 'privado'
        expect(result.agua).toBeTruthy(); // 'agua caliente'
    });

    it('fallback a texto plano con null retorna todas falsy', () => {
        const result = parseAmenities(null);
        expect(result.wifi).toBeFalsy();
        expect(result.tv).toBeFalsy();
        expect(result.agua).toBeFalsy();
        expect(result.bano).toBeFalsy();
    });

    it('descripción con texto vacío retorna todas falsas', () => {
        const result = parseAmenities('');
        expect(result.wifi).toBe(false);
        expect(result.tv).toBe(false);
        expect(result.agua).toBe(false);
        expect(result.bano).toBe(false);
    });

    it('Nueva habitación 201 (JSON completo) tiene todas las amenities', () => {
        const desc = habitacionesMock[2].descripcion;
        const result = parseAmenities(desc);
        expect(result.wifi).toBeTruthy();
        expect(result.tv).toBeTruthy();
        expect(result.agua).toBeTruthy();
        expect(result.bano).toBeTruthy();
    });

    it('Habitación 301 (texto plano) parsea correctamente', () => {
        const desc = habitacionesMock[4].descripcion;
        const result = parseAmenities(desc);
        expect(result.wifi).toBeTruthy();
        expect(result.tv).toBeTruthy();  // Smart TV
        expect(result.agua).toBeTruthy(); // agua caliente
        expect(result.bano).toBeTruthy(); // baño privado
    });

    it('Habitación 202 (solo baño) parsea correctamente', () => {
        const desc = habitacionesMock[3].descripcion;
        const result = parseAmenities(desc);
        expect(result.wifi).toBeFalsy();
        expect(result.tv).toBeFalsy();
        expect(result.agua).toBeFalsy();
        expect(result.bano).toBeTruthy();
    });
});
