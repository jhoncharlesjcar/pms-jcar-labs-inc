// @ts-nocheck
/**
 * REC-001 a REC-009: Tests de validación del schema de Recepción
 *
 * Tests de contrato que validan el Zod schema recepcionSchema
 * contra las reglas de negocio RN-REC-003, RN-REC-004, RN-REC-007, RN-REC-008.
 *
 * @see specs/domain-recepcion.md — Sección 7
 */
import { recepcionSchema } from '@/schemas/recepcion.schema';

// ─── Datos válidos base ───────────────────────────────────────────────────────

const baseReserva = {
    habitacion_id: 'hab-uuid-001',
    habitacion_numero: '101',
    habitacion_tipo: 'simple',
    huesped_nombre: 'Juan Perez',
    tipo_documento: 'DNI',
    huesped_dni: '12345678',
    huesped_sexo: 'masculino',
    huesped_fecha_nacimiento: '1990-05-15',
    huesped_telefono: '999888777',
    nacionalidad: 'Peruana',
    motivo_viaje: 'turismo',
    fecha_entrada: '2026-07-15',
    fecha_salida: '2026-07-18',
    noches: 3,
    precio_noche: 100,
    total: 300,
    incluye_igv: true,
    num_adultos: 1,
    num_ninos: 0,
    tiene_menores: false,
};

// ─── REC-001: Crear reserva con campos obligatorios ───────────────────────────

describe('REC-001: Validación de reserva completa', () => {
    it('acepta una reserva con todos los campos obligatorios', () => {
        const result = recepcionSchema.safeParse(baseReserva);
        expect(result.success).toBe(true);
    });

    it('acepta reserva con campos opcionales ausentes', () => {
        const minimal = {
            habitacion_id: 'hab-uuid-001',
            huesped_nombre: 'Juan Perez',
            tipo_documento: 'DNI',
            huesped_dni: '12345678',
            fecha_entrada: '2026-07-15',
            fecha_salida: '2026-07-18',
            noches: 3,
            precio_noche: 100,
            total: 300,
            num_adultos: 1,
        };
        const result = recepcionSchema.safeParse(minimal);
        expect(result.success).toBe(true);
    });
});

// ─── REC-002: Rechazar reserva sin nombre de huésped ──────────────────────────

describe('REC-002: Nombre de huésped obligatorio', () => {
    it('rechaza reserva sin nombre', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            huesped_nombre: '',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza nombre con menos de 3 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            huesped_nombre: 'AB',
        });
        expect(result.success).toBe(false);
    });

    it('acepta nombre con exactamente 3 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            huesped_nombre: 'ABC',
        });
        expect(result.success).toBe(true);
    });

    it('acepta nombre con espacios (trimmed)', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            huesped_nombre: '  Juan Perez  ',
        });
        expect(result.success).toBe(true);
    });
});

// ─── REC-003: Rechazar reserva sin habitación seleccionada ─────────────────────

describe('REC-003: Habitación obligatoria', () => {
    it('rechaza reserva sin habitacion_id', () => {
        const { habitacion_id, ...rest } = baseReserva;
        const result = recepcionSchema.safeParse(rest);
        expect(result.success).toBe(false);
    });

    it('rechaza habitacion_id vacío', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            habitacion_id: '',
        });
        expect(result.success).toBe(false);
    });
});

// ─── REC-004: Rechazar reserva con fecha_salida ≤ fecha_entrada ───────────────

describe('REC-004: Fechas válidas', () => {
    it('rechaza cuando fecha_salida es igual a fecha_entrada', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            fecha_salida: '2026-07-15',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza cuando fecha_salida es anterior a fecha_entrada', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            fecha_entrada: '2026-07-20',
            fecha_salida: '2026-07-15',
        });
        expect(result.success).toBe(false);
    });

    it('acepta cuando fecha_salida es posterior a fecha_entrada', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            fecha_entrada: '2026-07-15',
            fecha_salida: '2026-07-16',
        });
        expect(result.success).toBe(true);
    });
});

// ─── REC-005: Validar DNI exactamente 8 dígitos numéricos ─────────────────────

describe('REC-005: Validación de DNI', () => {
    it('acepta DNI con exactamente 8 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'DNI',
            huesped_dni: '12345678',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza DNI con 7 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'DNI',
            huesped_dni: '1234567',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza DNI con 9 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'DNI',
            huesped_dni: '123456789',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza DNI con letras', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'DNI',
            huesped_dni: '1234ABCD',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza DNI vacío', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'DNI',
            huesped_dni: '',
        });
        expect(result.success).toBe(false);
    });
});

// ─── REC-006: Validar RUC exactamente 11 dígitos numéricos ────────────────────

describe('REC-006: Validación de RUC', () => {
    it('acepta RUC con exactamente 11 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'RUC',
            huesped_dni: '20123456789',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza RUC con 10 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'RUC',
            huesped_dni: '2012345678',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza RUC con 12 dígitos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'RUC',
            huesped_dni: '201234567890',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza RUC con letras', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'RUC',
            huesped_dni: '20ABCDEFGHI',
        });
        expect(result.success).toBe(false);
    });
});

// ─── Validación de Pasaporte ──────────────────────────────────────────────────

describe('Validación de Pasaporte', () => {
    it('acepta pasaporte con 6 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'pasaporte',
            huesped_dni: 'ABC123',
        });
        expect(result.success).toBe(true);
    });

    it('acepta pasaporte con 15 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'pasaporte',
            huesped_dni: 'ABC123456789012',
        });
        expect(result.success).toBe(true);
    });

    it('rechaza pasaporte con 5 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'pasaporte',
            huesped_dni: 'AB123',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza pasaporte con 16 caracteres', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tipo_documento: 'pasaporte',
            huesped_dni: 'ABC1234567890123',
        });
        expect(result.success).toBe(false);
    });
});

// ─── REC-008: Mínimo 1 adulto ────────────────────────────────────────────────

describe('REC-008: Mínimo 1 adulto', () => {
    it('rechaza reserva sin adultos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            num_adultos: 0,
        });
        expect(result.success).toBe(false);
    });

    it('acepta reserva con 1 adulto', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            num_adultos: 1,
        });
        expect(result.success).toBe(true);
    });

    it('acepta reserva con múltiples adultos', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            num_adultos: 4,
        });
        expect(result.success).toBe(true);
    });
});

// ─── REC-009: Detalle de menores obligatorio ──────────────────────────────────

describe('REC-009: Menores de edad', () => {
    it('rechaza tiene_menores = true sin observaciones', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tiene_menores: true,
            observaciones: '',
        });
        expect(result.success).toBe(false);
    });

    it('rechaza tiene_menores = true con observaciones muy cortas', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tiene_menores: true,
            observaciones: 'ABC',
        });
        expect(result.success).toBe(false);
    });

    it('acepta tiene_menores = true con observaciones válidas', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tiene_menores: true,
            observaciones: 'Menor: Mateo Perez, DNI 77777777',
        });
        expect(result.success).toBe(true);
    });

    it('acepta tiene_menores = false sin observaciones', () => {
        const result = recepcionSchema.safeParse({
            ...baseReserva,
            tiene_menores: false,
            observaciones: '',
        });
        expect(result.success).toBe(true);
    });
});
