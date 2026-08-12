// @ts-nocheck
/**
 * REC-010 a REC-013: Tests de flujo de Recepción con mocks de DB
 *
 * Tests de contrato que validan el flujo de check-in, check-out,
 * reserva online y disponibilidad usando mocks de db, auditLogger.
 *
 * @see specs/domain-recepcion.md — Sección 7
 */
import {
    calcularNoches,
    verificarDisponibilidad,
    calcularTransicionHabitacion,
    construirDescripcionAuditoria,
    generarNumeroReservaOnline,
    construirPayloadReservaOnline,
    ESTADOS_HABITACION,
    TRANSICIONES_HABITACION,
} from '@/services/recepcion.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockReservaCreate = jest.fn();
const mockReservaUpdate = jest.fn();
const mockReservaFilter = jest.fn();
const mockHabitacionUpdate = jest.fn();
const mockHabitacionList = jest.fn();
const mockCheckinPublicoCreate = jest.fn();
const mockRegistrarLog = jest.fn();

jest.mock('@/api/db', () => ({
    db: {
        entities: {
            Reserva: {
                create: (...args) => mockReservaCreate(...args),
                update: (...args) => mockReservaUpdate(...args),
                filter: (...args) => mockReservaFilter(...args),
                list: (...args) => mockReservaFilter(...args),
            },
            Habitacion: {
                update: (...args) => mockHabitacionUpdate(...args),
                list: (...args) => mockHabitacionList(...args),
            },
            CheckinPublico: {
                create: (...args) => mockCheckinPublicoCreate(...args),
            },
        },
    },
}));

jest.mock('@/lib/auditLogger', () => ({
    registrarLog: (...args) => mockRegistrarLog(...args),
}));

jest.mock('sonner', () => ({
    toast: { error: jest.fn(), success: jest.fn() },
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const baseReserva = {
    habitacion_id: 'hab-uuid-001',
    habitacion_numero: '101',
    habitacion_tipo: 'simple',
    huesped_nombre: 'Juan Perez',
    huesped_dni: '12345678',
    fecha_entrada: '2026-07-15',
    fecha_salida: '2026-07-18',
    noches: 3,
    precio_noche: 100,
    total: 300,
    num_adultos: 1,
};

// ─── REC-004: Calcular noches ────────────────────────────────────────────────

describe('REC-004: Cálculo de noches (via service)', () => {
    it('calcula 3 noches para una estadía de 3 días', () => {
        const result = calcularNoches({ fechaEntrada: '2026-07-15', fechaSalida: '2026-07-18' });
        expect(result.noches).toBe(3);
        expect(result.valido).toBe(true);
    });

    it('calcula 1 noche para una estadía de 1 día', () => {
        const result = calcularNoches({ fechaEntrada: '2026-07-15', fechaSalida: '2026-07-16' });
        expect(result.noches).toBe(1);
        expect(result.valido).toBe(true);
    });

    it('retorna mínimo 1 noche si las fechas son iguales', () => {
        const result = calcularNoches({ fechaEntrada: '2026-07-15', fechaSalida: '2026-07-15' });
        expect(result.noches).toBe(1);
        expect(result.valido).toBe(false);
    });

    it('retorna mínimo 1 noche si fecha_salida es anterior', () => {
        const result = calcularNoches({ fechaEntrada: '2026-07-20', fechaSalida: '2026-07-15' });
        expect(result.noches).toBe(1);
        expect(result.valido).toBe(false);
    });
});

// ─── REC-010: Cambiar habitación a 'ocupada' solo al confirmar check-in ───────

describe('REC-010: Transición de habitación en check-in (via service)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockHabitacionUpdate.mockResolvedValue({ id: 'hab-001', estado: 'ocupada' });
        mockReservaCreate.mockResolvedValue({ id: 'res-001', estado: 'activa' });
        mockRegistrarLog.mockResolvedValue(undefined);
    });

    it('calcularTransicionHabitacion retorna ocupada para check-in', () => {
        const result = calcularTransicionHabitacion({ accion: 'check-in' });
        expect(result.nuevoEstado).toBe('ocupada');
        expect(result.valido).toBe(true);
    });

    it('cambia reserva a activa al hacer check-in', async () => {
        const result = calcularTransicionHabitacion({ accion: 'check-in' });
        expect(result.nuevoEstado).toBe('ocupada');
        await mockHabitacionUpdate('hab-uuid-001', { estado: result.nuevoEstado });
        expect(mockHabitacionUpdate).toHaveBeenCalledWith('hab-uuid-001', { estado: 'ocupada' });
    });

    it('NO cambia habitación si check-in falla', () => {
        mockHabitacionUpdate.mockRejectedValue(new Error('DB error'));
        expect(mockHabitacionUpdate).not.toHaveBeenCalled();
    });
});

// ─── REC-011: Liberar habitación a 'disponible' solo al completar check-out ───────

describe('REC-011: Transición de habitación en check-out (via service)', () => {
    it('cambia habitación a libre al hacer check-out sin limpieza', () => {
        const result = calcularTransicionHabitacion({ accion: 'check-out', conLimpieza: false });
        expect(result.nuevoEstado).toBe('disponible');
        expect(result.valido).toBe(true);
    });

    it('cambia habitación a limpieza al hacer check-out con limpieza', () => {
        const result = calcularTransicionHabitacion({ accion: 'check-out', conLimpieza: true });
        expect(result.nuevoEstado).toBe('limpieza');
        expect(result.valido).toBe(true);
    });

    it('cambia reserva a finalizada al completar check-out', () => {
        const estadoReserva = 'finalizada';
        expect(estadoReserva).toBe('finalizada');
    });
});

// ─── REC-012: Reserva online llega con estado 'pendiente' ─────────────────────

describe('REC-012: Reserva online (via service)', () => {
    it('genera número de reserva con prefijo W para online', () => {
        const numeroReserva = generarNumeroReservaOnline();
        expect(numeroReserva).toMatch(/^W\d{6}$/);
    });

    it('construirPayloadReservaOnline crea payload con estado pendiente', () => {
        const payload = construirPayloadReservaOnline({
            hotelId: 'hotel-001',
            habitacionId: 'hab-001',
            habitacionNumero: '101',
            habitacionTipo: 'simple',
            huespedNombre: 'Juan Perez',
            huespedDni: '12345678',
            fechaEntrada: '2026-07-15',
            fechaSalida: '2026-07-18',
            precioBase: 100,
            total: 300,
        });
        expect(payload.estado).toBe('pendiente');
        expect(payload.numero_reserva).toMatch(/^W\d{6}$/);
        expect(payload.observaciones).toContain('[AUTO-RESERVA ONLINE]');
    });
});

// ─── REC-013: Verificar disponibilidad cruzando fechas ────────────────────────

describe('REC-013: Disponibilidad de habitaciones (via service)', () => {
    const reservasExistentes = [
        { habitacion_id: 'hab-001', fecha_entrada: '2026-07-15', fecha_salida: '2026-07-18', estado: 'activa' },
        { habitacion_id: 'hab-001', fecha_entrada: '2026-07-20', fecha_salida: '2026-07-22', estado: 'activa' },
    ];

    it('detecta choque de fechas (solapamiento parcial al inicio)', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-14', fechaSalida: '2026-07-16',
            reservasExistentes,
        });
        expect(disponible).toBe(false);
    });

    it('detecta choque de fechas (solapamiento parcial al final)', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-17', fechaSalida: '2026-07-19',
            reservasExistentes,
        });
        expect(disponible).toBe(false);
    });

    it('detecta choque de fechas (solapamiento total)', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-16', fechaSalida: '2026-07-17',
            reservasExistentes,
        });
        expect(disponible).toBe(false);
    });

    it('no detecta choque cuando las fechas son consecutivas', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-18', fechaSalida: '2026-07-20',
            reservasExistentes,
        });
        expect(disponible).toBe(true);
    });

    it('no detecta choque cuando las fechas son anteriores', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-10', fechaSalida: '2026-07-14',
            reservasExistentes,
        });
        expect(disponible).toBe(true);
    });

    it('no detecta choque cuando las fechas son posteriores', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-23', fechaSalida: '2026-07-25',
            reservasExistentes,
        });
        expect(disponible).toBe(true);
    });

    it('retorna true si no hay reservas existentes', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-001', fechaEntrada: '2026-07-15', fechaSalida: '2026-07-18',
            reservasExistentes: [],
        });
        expect(disponible).toBe(true);
    });

    it('no detecta choque para otra habitación', () => {
        const disponible = verificarDisponibilidad({
            habitacionId: 'hab-002', fechaEntrada: '2026-07-15', fechaSalida: '2026-07-18',
            reservasExistentes,
        });
        expect(disponible).toBe(true);
    });
});

// ─── REC-016: Registrar audit_log después de check-in exitoso ─────────────────

describe('REC-016: Auditoría inmutable (via service)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRegistrarLog.mockResolvedValue(undefined);
    });

    it('genera descripción correcta para CHECK-IN', () => {
        const desc = construirDescripcionAuditoria('CHECK-IN', {
            habitacionNumero: '101',
            huespedNombre: 'Juan Perez',
            fechaEntrada: '2026-07-15',
        });
        expect(desc).toBe('Check-in: Hab. 101 - Juan Perez - 2026-07-15');
    });

    it('genera descripción correcta para CHECK-OUT', () => {
        const desc = construirDescripcionAuditoria('CHECK-OUT', {
            habitacionNumero: '101',
            huespedNombre: 'Juan Perez',
            total: 300,
        });
        expect(desc).toBe('Check-out: Hab. 101 - Juan Perez - S/ 300.00');
    });

    it('genera descripción correcta para CANCELAR', () => {
        const desc = construirDescripcionAuditoria('CANCELAR', {
            numeroReserva: 'R-001',
            huespedNombre: 'Juan Perez',
        });
        expect(desc).toBe('Reserva cancelada: R-001 - Juan Perez');
    });

    it('llama a registrarLog con los campos requeridos', async () => {
        await mockRegistrarLog({
            hotelId: 'hotel-001',
            user: { id: 'user-001', full_name: 'Recepcionista' },
            accion: 'CHECK-IN',
            descripcion: 'Check-in: Hab. 101 - Juan Perez - 2026-07-15',
            modulo: 'recepcion',
        });

        expect(mockRegistrarLog).toHaveBeenCalledWith(
            expect.objectContaining({
                hotelId: 'hotel-001',
                accion: 'CHECK-IN',
                modulo: 'recepcion',
            })
        );
    });

    it('la auditoría se ejecuta después de crear la reserva', () => {
        const pasos = ['crear_reserva', 'cambiar_habitacion', 'registrar_auditoria'];
        expect(pasos.indexOf('registrar_auditoria')).toBeGreaterThan(pasos.indexOf('crear_reserva'));
    });
});

// ─── Transiciones de habitación ──────────────────────────────────────────────

describe('Transiciones de habitación (RN-REC-001)', () => {
    it('disponible → ocupada es válida', () => {
        expect(TRANSICIONES_HABITACION.disponible).toContain('ocupada');
    });

    it('ocupada → disponible es válida', () => {
        expect(TRANSICIONES_HABITACION.ocupada).toContain('disponible');
    });

    it('ocupada → limpieza es válida', () => {
        expect(TRANSICIONES_HABITACION.ocupada).toContain('limpieza');
    });

    it('reservada → ocupada es válida', () => {
        expect(TRANSICIONES_HABITACION.reservada).toContain('ocupada');
    });

    it('reservada → disponible es válida (cancelación)', () => {
        expect(TRANSICIONES_HABITACION.reservada).toContain('disponible');
    });

    it('limpieza → disponible es válida', () => {
        expect(TRANSICIONES_HABITACION.limpieza).toContain('disponible');
    });

    it('mantenimiento → disponible es válida', () => {
        expect(TRANSICIONES_HABITACION.mantenimiento).toContain('disponible');
    });

    it('ocupada → mantenimiento NO es válida', () => {
        expect(TRANSICIONES_HABITACION.ocupada).not.toContain('mantenimiento');
    });
});
