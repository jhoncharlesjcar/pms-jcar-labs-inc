// @ts-nocheck
/**
 * REC-014 a REC-017: Tests de tarifas dinámicas, pre-check-in
 *
 * Tests de contrato que validan el cálculo de tarifas dinámicas
 * y el flujo de pre-check-in digital.
 *
 * @see specs/domain-recepcion.md — Sección 7
 */
import {
    calcularTarifaDinamica,
    calcularDesgloseIGV,
    extraerDatosPreCheckin,
    construirPayloadPreCheckin,
    validarDocumento,
    TASA_IGV,
} from '@/services/recepcion.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCheckinCreate = jest.fn();

jest.mock('@/api/db', () => ({
    db: {
        entities: {
            CheckinPublico: {
                create: (...args) => mockCheckinCreate(...args),
            },
        },
    },
}));

jest.mock('sonner', () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}));

// ─── REC-014: Aplicar tarifa dinámica de temporada ────────────────────────────

describe('REC-014: Tarifa dinámica de temporada (via service)', () => {
    it('aplica factor de temporada sobre tarifa base', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Semana Santa',
                tipo: 'temporada',
                fecha_inicio: '2026-04-10',
                fecha_fin: '2026-04-20',
                habitacion_tipo: 'todos',
                factor_ajuste: 1.25,
            },
        ];

        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-04-12',
            fechaSalida: '2026-04-15',
            precioBase: 100,
            tarifas,
        });

        expect(resultado.total).toBe(375);
        expect(resultado.noches).toBe(3);
        expect(resultado.explicacion).toContain('Semana Santa');
        expect(resultado.explicacion).toContain('+25%');
    });

    it('no aplica temporada cuando las fechas están fuera del rango', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Semana Santa',
                tipo: 'temporada',
                fecha_inicio: '2026-04-10',
                fecha_fin: '2026-04-20',
                habitacion_tipo: 'todos',
                factor_ajuste: 1.25,
            },
        ];

        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-18',
            precioBase: 100,
            tarifas,
        });

        expect(resultado.total).toBe(300);
        expect(resultado.explicacion).toBe('');
    });

    it('aplica temporada solo a tipos de habitación específicos', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Navidad',
                tipo: 'temporada',
                fecha_inicio: '2026-12-20',
                fecha_fin: '2026-12-31',
                habitacion_tipo: 'matrimonial',
                factor_ajuste: 1.50,
            },
        ];

        const resultadoSimple = calcularTarifaDinamica({
            fechaEntrada: '2026-12-22',
            fechaSalida: '2026-12-24',
            precioBase: 100,
            tarifas,
            habitacionTipo: 'simple',
        });

        expect(resultadoSimple.total).toBe(200);

        const resultadoMatrimonial = calcularTarifaDinamica({
            fechaEntrada: '2026-12-22',
            fechaSalida: '2026-12-24',
            precioBase: 100,
            tarifas,
            habitacionTipo: 'matrimonial',
        });

        expect(resultadoMatrimonial.total).toBe(300);
    });

    it('prioriza temporada sobre día de semana', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Feriado',
                tipo: 'temporada',
                fecha_inicio: '2026-07-15',
                fecha_fin: '2026-07-16',
                habitacion_tipo: 'todos',
                factor_ajuste: 1.30,
            },
            {
                id: 't2',
                nombre: 'Viernes',
                tipo: 'dia_semana',
                dias_semana: [5],
                habitacion_tipo: 'todos',
                factor_ajuste: 1.20,
            },
        ];

        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-16',
            precioBase: 100,
            tarifas,
        });

        expect(resultado.total).toBe(130);
        expect(resultado.explicacion).toContain('Feriado');
    });
});

// ─── REC-015: Aplicar tarifa de día de semana ─────────────────────────────────

describe('REC-015: Tarifa de día de semana (via service)', () => {
    it('aplica factor de fin de semana (viernes y sábado)', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Fin de semana',
                tipo: 'dia_semana',
                dias_semana: [5, 6],
                habitacion_tipo: 'todos',
                factor_ajuste: 1.20,
            },
        ];

        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-17',
            fechaSalida: '2026-07-20',
            precioBase: 100,
            tarifas,
        });

        expect(resultado.total).toBe(340);
        expect(resultado.noches).toBe(3);
        expect(resultado.explicacion).toContain('Fin de semana');
    });

    it('no aplica tarifa cuando el día no está en la lista', () => {
        const tarifas = [
            {
                id: 't1',
                nombre: 'Lunes',
                tipo: 'dia_semana',
                dias_semana: [1],
                habitacion_tipo: 'todos',
                factor_ajuste: 0.80,
            },
        ];

        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-16',
            precioBase: 100,
            tarifas,
        });

        expect(resultado.total).toBe(100);
        expect(resultado.explicacion).toBe('');
    });
});

// ─── Desglose IGV ────────────────────────────────────────────────────────────

describe('Desglose IGV (via service)', () => {
    it('calcula IGV correctamente cuando incluye_igv = true', () => {
        const result = calcularDesgloseIGV(118, true);
        expect(result.baseImponible).toBe(100);
        expect(result.igv).toBe(18);
        expect(result.totalFinal).toBe(118);
    });

    it('no aplica IGV cuando incluye_igv = false', () => {
        const result = calcularDesgloseIGV(100, false);
        expect(result.baseImponible).toBe(100);
        expect(result.igv).toBe(0);
        expect(result.totalFinal).toBe(100);
    });

    it('calcula IGV con decimales correctamente', () => {
        const result = calcularDesgloseIGV(250.50, true);
        expect(result.baseImponible).toBeCloseTo(212.29, 1);
        expect(result.igv).toBeCloseTo(38.21, 1);
    });
});

// ─── REC-017: Pre-check-in permite auto-llenar datos ──────────────────────────

describe('REC-017: Pre-check-in digital (via service)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCheckinCreate.mockResolvedValue({
            id: 'checkin-001',
            hotel_id: 'hotel-001',
            huesped_nombre: 'Juan Perez',
            huesped_dni: '12345678',
        });
    });

    it('construirPayloadPreCheckin crea payload correcto', async () => {
        const payload = construirPayloadPreCheckin('hotel-001', {
            hotel_id: 'hotel-001',
            huesped_nombre: 'Juan Perez',
            tipo_documento: 'DNI',
            huesped_dni: '12345678',
            huesped_sexo: 'masculino',
            huesped_fecha_nacimiento: '1990-05-15',
            huesped_telefono: '999888777',
            huesped_procedencia: 'Lima',
            huesped_destino: 'Cusco',
            motivo_viaje: 'turismo',
            nacionalidad: 'Peruana',
        });

        const result = await mockCheckinCreate(payload);
        expect(result.huesped_nombre).toBe('Juan Perez');
        expect(result.huesped_dni).toBe('12345678');
    });

    it('extraerDatosPreCheckin mapea datos correctamente para auto-llenado', () => {
        const preCheckin = {
            id: 'checkin-001',
            huesped_nombre: 'Juan Perez',
            tipo_documento: 'DNI',
            huesped_dni: '12345678',
            huesped_sexo: 'masculino',
            huesped_fecha_nacimiento: '1990-05-15',
            huesped_telefono: '999888777',
            huesped_procedencia: 'Lima',
            huesped_destino: 'Cusco',
            motivo_viaje: 'turismo',
            nacionalidad: 'Peruana',
        };

        const datos = extraerDatosPreCheckin(preCheckin);

        expect(datos.huesped_nombre).toBe('Juan Perez');
        expect(datos.huesped_dni).toBe('12345678');
        expect(datos.tipo_documento).toBe('DNI');
        expect(datos.huesped_sexo).toBe('masculino');
        expect(datos.huesped_procedencia).toBe('Lima');
        expect(datos.huesped_destino).toBe('Cusco');
        expect(datos.motivo_viaje).toBe('turismo');
        expect(datos.pre_checkin_id).toBe('checkin-001');
    });

    it('extraerDatosPreCheckin usa defaults para campos ausentes', () => {
        const preCheckin = {
            id: 'checkin-002',
            huesped_nombre: 'Maria Garcia',
            huesped_dni: '87654321',
            tipo_documento: 'DNI',
        };

        const datos = extraerDatosPreCheckin(preCheckin);

        expect(datos.huesped_nombre).toBe('Maria Garcia');
        expect(datos.huesped_sexo).toBe('no_especificado');
        expect(datos.motivo_viaje).toBe('turismo');
        expect(datos.nacionalidad).toBe('Peruana');
        expect(datos.pre_checkin_id).toBe('checkin-002');
    });

    it('pre_checkin_id permite vincular datos al check-in', () => {
        const preCheckin = {
            id: 'checkin-001',
            huesped_nombre: 'Juan Perez',
            huesped_dni: '12345678',
        };

        const datos = extraerDatosPreCheckin(preCheckin);
        expect(datos.pre_checkin_id).toBe('checkin-001');
        expect(datos.huesped_nombre).toBe('Juan Perez');
    });
});

// ─── REC-005/006: Validación de documento ────────────────────────────────────

describe('Validación de documento (via service)', () => {
    it('acepta DNI con exactamente 8 dígitos', () => {
        const result = validarDocumento({ tipo: 'DNI', documento: '12345678' });
        expect(result.valido).toBe(true);
    });

    it('rechaza DNI con 7 dígitos', () => {
        const result = validarDocumento({ tipo: 'DNI', documento: '1234567' });
        expect(result.valido).toBe(false);
    });

    it('acepta RUC con exactamente 11 dígitos', () => {
        const result = validarDocumento({ tipo: 'RUC', documento: '20123456789' });
        expect(result.valido).toBe(true);
    });

    it('rechaza RUC con 10 dígitos', () => {
        const result = validarDocumento({ tipo: 'RUC', documento: '2012345678' });
        expect(result.valido).toBe(false);
    });

    it('acepta pasaporte con 6 caracteres', () => {
        const result = validarDocumento({ tipo: 'pasaporte', documento: 'ABC123' });
        expect(result.valido).toBe(true);
    });

    it('rechaza pasaporte con 5 caracteres', () => {
        const result = validarDocumento({ tipo: 'pasaporte', documento: 'AB123' });
        expect(result.valido).toBe(false);
    });

    it('rechaza documento vacío', () => {
        const result = validarDocumento({ tipo: 'DNI', documento: '' });
        expect(result.valido).toBe(false);
    });
});

// ─── REC-007: Cálculo de noches (via tarifa) ─────────────────────────────────

describe('REC-007: Cálculo de noches en tarifa (via service)', () => {
    it('calcula noches correctamente para tarifa', () => {
        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-18',
            precioBase: 100,
            tarifas: [],
        });

        expect(resultado.noches).toBe(3);
        expect(resultado.total).toBe(300);
    });

    it('mínimo 1 noche para estadía misma día', () => {
        const resultado = calcularTarifaDinamica({
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-15',
            precioBase: 100,
            tarifas: [],
        });

        expect(resultado.noches).toBe(1);
        expect(resultado.total).toBe(100);
    });
});
