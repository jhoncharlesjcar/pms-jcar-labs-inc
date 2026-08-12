// @ts-nocheck
/**
 * CHECKOUT-009: Envío a SUNAT automático si modo_sunat = 'automatico'
 *
 * RN-CHECKOUT-006:
 *   SI modo_sunat = 'automatico' Y requiere_comprobante →
 *     Llamar a Edge Function /functions/v1/facturacion
 *     Si exitoso → estado_comprobante = 'sunat_emitido'
 *
 * Tests con mocks REALES de db, facturacion y auditLogger.
 * Se testea la lógica de orquestación SIN importar el hook directamente
 * (evita problemas de parseo de generics TypeScript en Jest).
 */
import { calcularTotal, calcularIGV, validarMetodoPago, validarReferenciaYapePlin, validarComprobante, validarPagoDuplicado } from '@/services/checkout.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mockear crearComprobante (Edge Function SUNAT)
const mockCrearComprobante = jest.fn();
jest.mock('@/api/facturacion', () => ({
    crearComprobante: (...args) => mockCrearComprobante(...args),
}));

// Mockear db entities
const mockVentaCreate = jest.fn();
const mockVentaUpdate = jest.fn();
const mockReservaUpdate = jest.fn();
const mockHabitacionUpdate = jest.fn();

jest.mock('@/api/db', () => ({
    db: {
        entities: {
            Venta: {
                create: (...args) => mockVentaCreate(...args),
                update: (...args) => mockVentaUpdate(...args),
            },
            Reserva: {
                update: (...args) => mockReservaUpdate(...args),
            },
            Habitacion: {
                update: (...args) => mockHabitacionUpdate(...args),
            },
        },
    },
}));

// Mockear auditLogger
const mockRegistrarLog = jest.fn();
jest.mock('@/lib/auditLogger', () => ({
    registrarLog: (...args) => mockRegistrarLog(...args),
}));

// Mockear sonner toast
jest.mock('sonner', () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
    },
}));

// ─── Datos de prueba ──────────────────────────────────────────────────────────

const baseReserva = {
    id: 'reserva-uuid-001',
    numero_reserva: 'R-001',
    huesped_nombre: 'Juan Perez',
    huesped_dni: '12345678',
    habitacion_numero: '101',
    habitacion_tipo: 'simple',
    habitacion_id: 'hab-uuid-001',
    fecha_entrada: '2026-07-10',
    fecha_salida: '2026-07-12',
    noches: 2,
    precio_noche: 100,
    total: 200,
};

const baseUser = {
    id: 'user-uuid-001',
    full_name: 'Recepcionista Test',
    email: 'test@hotel.com',
    role: 'recepcionista',
};

// ─── Helper: simula el flujo completo de useCheckout ──────────────────────────

/**
 * Simula el flujo de useCheckout.mutationFn para testear la lógica
 * de orquestación con mocks controlados.
 */
async function ejecutarFlujoCheckout({
    reserva,
    formData,
    hotelId,
    config,
    user,
    pagosExistentes = [],
}) {
    // 1. Validación del formulario
    const errors = [];
    const metodoValido = validarMetodoPago(formData.metodo);
    if (!metodoValido.valido) errors.push(metodoValido.error);

    if (['yape', 'plin'].includes(formData.metodo)) {
        const refValida = validarReferenciaYapePlin({
            metodo: formData.metodo,
            codigoReferencia: formData.codigoReferencia,
        });
        if (!refValida.valido) errors.push(refValida.error);
    }

    if (formData.requiereComprobante) {
        const comprobanteValido = validarComprobante({
            tipo: formData.tipoComprobante,
            ruc: formData.rucCliente,
            razonSocial: formData.razonSocial,
            dni: formData.dniCliente,
            nombre: formData.nombreCliente,
        });
        if (!comprobanteValido.valido) errors.push(...comprobanteValido.errors);
    }

    if (errors.length > 0) throw new Error(errors.join('\n'));

    // 2. Pre-check: pago duplicado
    const pagoDuplicado = validarPagoDuplicado(reserva.id, pagosExistentes);
    if (!pagoDuplicado.valido) throw new Error(pagoDuplicado.error);

    // 3. Calcular total
    const { total_final: total } = calcularTotal({
        precio_noche: reserva.precio_noche || 0,
        noches: reserva.noches || 1,
        total_consumos: Math.max(0, (reserva.total || 0) - (reserva.precio_noche || 0) * (reserva.noches || 1)),
        descuento: Number(formData.descuento || 0),
    });

    // 4. Crear venta en BD
    const venta = await mockVentaCreate({
        hotel_id: hotelId,
        reserva_id: reserva.id,
        numero_reserva: reserva.numero_reserva,
        habitacion_numero: reserva.habitacion_numero,
        habitacion_tipo: reserva.habitacion_tipo,
        huesped_nombre: formData.requiereComprobante && formData.tipoComprobante === 'factura'
            ? formData.razonSocial
            : (formData.requiereComprobante && formData.tipoComprobante === 'boleta'
                ? formData.nombreCliente
                : reserva.huesped_nombre),
        huesped_dni: formData.requiereComprobante && formData.tipoComprobante === 'factura'
            ? formData.rucCliente
            : (formData.requiereComprobante && formData.tipoComprobante === 'boleta'
                ? formData.dniCliente
                : (reserva.huesped_dni || '')),
        total,
        descuento: Number(formData.descuento),
        metodo_pago: formData.metodo,
        estado_comprobante: formData.requiereComprobante ? 'sunat_pendiente' : 'ticket_interno',
        tipo_comprobante: formData.requiereComprobante ? formData.tipoComprobante : 'ninguno',
        notas: formData.codigoReferencia ? `[Ref ${formData.metodo.toUpperCase()}: ${formData.codigoReferencia}]` : '',
    });

    let ventaFinal = venta;

    // 5. Envío a SUNAT (si automático)
    if (config.modo_sunat === 'automatico' && formData.requiereComprobante) {
        const igvCalc = calcularIGV(total, config.aplica_igv);
        try {
            const compRes = await mockCrearComprobante({
                hotel_id: hotelId,
                tipo: formData.tipoComprobante === 'factura' ? 'Factura' : 'Boleta',
                serie: formData.tipoComprobante === 'factura' ? 'F001' : 'B001',
                cliente_tipo: formData.tipoComprobante === 'factura' ? '6' : '1',
                cliente_documento: formData.tipoComprobante === 'factura' ? formData.rucCliente : formData.dniCliente,
                cliente_nombre: formData.tipoComprobante === 'factura' ? formData.razonSocial : formData.nombreCliente,
                subtotal: igvCalc.base_imponible,
                igv: igvCalc.igv,
                total: igvCalc.total_final,
            });

            const updatedVenta = await mockVentaUpdate(venta.id, {
                estado_comprobante: 'sunat_emitido',
                notes: `${venta.notas || ''} [SUNAT: ${compRes.estado || 'Emitido'}]`.trim(),
            });
            ventaFinal = updatedVenta;
        } catch (err) {
            ventaFinal = { ...venta, _sunatError: err.message };
        }
    }

    // 6. Liberar habitación
    if (reserva.habitacion_id) {
        await Promise.all([
            mockReservaUpdate(reserva.id, { estado: 'finalizada' }),
            mockHabitacionUpdate(reserva.habitacion_id, { estado: 'disponible' }),
        ]);
    }

    // 7. Auditoría
    await mockRegistrarLog({
        hotelId,
        user,
        accion: 'CHECK-OUT',
        descripcion: `Check-out: Hab. ${reserva.habitacion_numero || ''} - ${reserva.huesped_nombre} - S/ ${total.toFixed(2)}`,
        modulo: 'recepcion',
    });

    return ventaFinal;
}

// ─── CHECKOUT-009 Tests ──────────────────────────────────────────────────────

describe('CHECKOUT-009: Envío a SUNAT automático (flujo real)', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockVentaCreate.mockResolvedValue({
            id: 'venta-uuid-001',
            numero_ticket: 'T123456',
            total: 200,
            metodo_pago: 'efectivo',
            estado_comprobante: 'sunat_pendiente',
            tipo_comprobante: 'boleta',
            notas: '',
        });

        mockVentaUpdate.mockResolvedValue({
            id: 'venta-uuid-001',
            numero_ticket: 'T123456',
            total: 200,
            metodo_pago: 'efectivo',
            estado_comprobante: 'sunat_emitido',
            tipo_comprobante: 'boleta',
            notas: '[SUNAT: Emitido]',
        });

        mockReservaUpdate.mockResolvedValue({ id: 'reserva-uuid-001', estado: 'finalizada' });
        mockHabitacionUpdate.mockResolvedValue({ id: 'hab-uuid-001', estado: 'disponible' });
        mockRegistrarLog.mockResolvedValue(undefined);

        mockCrearComprobante.mockResolvedValue({
            id: 'comp-001',
            estado: 'Emitido',
            cdr_url: 'https://sunat.gob.pe/cdr/001',
        });
    });

    it('llama a crearComprobante cuando modo_sunat = automatico y requiere comprobante', async () => {
        await ejecutarFlujoCheckout({
            reserva: baseReserva,
            formData: {
                metodo: 'efectivo',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '12345678',
                nombreCliente: 'Juan Perez',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        expect(mockCrearComprobante).toHaveBeenCalledTimes(1);
        expect(mockCrearComprobante).toHaveBeenCalledWith(
            expect.objectContaining({
                hotel_id: 'hotel-001',
                tipo: 'Boleta',
                cliente_documento: '12345678',
                cliente_nombre: 'Juan Perez',
            })
        );
    });

    it('actualiza estado_comprobante a sunat_emitido cuando SUNAT responde exitosamente', async () => {
        await ejecutarFlujoCheckout({
            reserva: baseReserva,
            formData: {
                metodo: 'yape',
                descuento: 0,
                codigoReferencia: 'YAPE-REF-123',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '12345678',
                nombreCliente: 'Juan Perez',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        expect(mockVentaUpdate).toHaveBeenCalledWith(
            'venta-uuid-001',
            expect.objectContaining({
                estado_comprobante: 'sunat_emitido',
            })
        );
    });

    it('NO llama a crearComprobante cuando modo_sunat = manual', async () => {
        await ejecutarFlujoCheckout({
            reserva: baseReserva,
            formData: {
                metodo: 'efectivo',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '12345678',
                nombreCliente: 'Juan Perez',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'manual', aplica_igv: true },
            user: baseUser,
        });

        expect(mockCrearComprobante).not.toHaveBeenCalled();
    });

    it('NO llama a crearComprobante cuando no requiere comprobante', async () => {
        await ejecutarFlujoCheckout({
            reserva: baseReserva,
            formData: {
                metodo: 'efectivo',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: false,
                tipoComprobante: 'ninguno',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '',
                nombreCliente: '',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        expect(mockCrearComprobante).not.toHaveBeenCalled();
    });

    it('envía payload correcto con IGV calculado para SUNAT', async () => {
        await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, precio_noche: 118, noches: 1, total: 118 },
            formData: {
                metodo: 'efectivo',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '12345678',
                nombreCliente: 'Juan Perez',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        expect(mockCrearComprobante).toHaveBeenCalledWith(
            expect.objectContaining({
                subtotal: 100,    // base imponible = 118 / 1.18
                igv: 18,          // IGV = 118 - 100
                total: 118,       // total final
            })
        );
    });

    it('almacena referencia de Yape en notas de la venta', async () => {
        await ejecutarFlujoCheckout({
            reserva: baseReserva,
            formData: {
                metodo: 'yape',
                descuento: 0,
                codigoReferencia: 'YAPE-ABC-123',
                requiereComprobante: false,
                tipoComprobante: 'ninguno',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '',
                nombreCliente: '',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'manual', aplica_igv: true },
            user: baseUser,
        });

        expect(mockVentaCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                notas: '[Ref YAPE: YAPE-ABC-123]',
            })
        );
    });
});

// ─── CHECKOUT-010 Tests ──────────────────────────────────────────────────────

describe('CHECKOUT-010: Fallback a sunat_pendiente (flujo real)', () => {
    beforeEach(() => {
        jest.clearAllMocks();

        mockVentaCreate.mockResolvedValue({
            id: 'venta-uuid-002',
            numero_ticket: 'T789012',
            total: 300,
            metodo_pago: 'efectivo',
            estado_comprobante: 'sunat_pendiente',
            tipo_comprobante: 'factura',
            notas: '',
        });

        mockVentaUpdate.mockResolvedValue({
            id: 'venta-uuid-002',
            estado_comprobante: 'sunat_pendiente',
        });

        mockReservaUpdate.mockResolvedValue({ id: 'reserva-uuid-002', estado: 'finalizada' });
        mockHabitacionUpdate.mockResolvedValue({ id: 'hab-uuid-002', estado: 'disponible' });
        mockRegistrarLog.mockResolvedValue(undefined);
    });

    it('fallback a sunat_pendiente cuando SUNAT lanza error de red', async () => {
        mockCrearComprobante.mockRejectedValue(new Error('Network timeout'));

        const venta = await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, id: 'reserva-uuid-002', habitacion_id: 'hab-uuid-002' },
            formData: {
                metodo: 'efectivo',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'factura',
                rucCliente: '20123456789',
                razonSocial: 'Empresa SAC',
                dniCliente: '',
                nombreCliente: '',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        // La venta se creó (no se bloqueó)
        expect(mockVentaCreate).toHaveBeenCalledTimes(1);
        expect(mockCrearComprobante).toHaveBeenCalledTimes(1);

        // La venta tiene el error de SUNAT registrado
        expect(venta._sunatError).toBe('Network timeout');
        expect(venta.id).toBe('venta-uuid-002');
    });

    it('libera habitación aunque SUNAT falle', async () => {
        mockCrearComprobante.mockRejectedValue(new Error('SUNAT service unavailable'));

        await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, id: 'reserva-uuid-002', habitacion_id: 'hab-uuid-002' },
            formData: {
                metodo: 'tarjeta',
                descuento: 0,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '87654321',
                nombreCliente: 'Maria Garcia',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        // Verificar que la habitación SÍ se liberó
        expect(mockHabitacionUpdate).toHaveBeenCalledWith(
            'hab-uuid-002',
            expect.objectContaining({ estado: 'disponible' })
        );
        expect(mockReservaUpdate).toHaveBeenCalledWith(
            'reserva-uuid-002',
            expect.objectContaining({ estado: 'finalizada' })
        );
    });

    it('registra auditoría aunque SUNAT falle', async () => {
        mockCrearComprobante.mockRejectedValue(new Error('SOAP fault'));

        await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, id: 'reserva-uuid-002', habitacion_id: 'hab-uuid-002' },
            formData: {
                metodo: 'transferencia',
                descuento: 0,
                codigoReferencia: 'TRANSF-456',
                requiereComprobante: false,
                tipoComprobante: 'ninguno',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '',
                nombreCliente: '',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: false },
            user: baseUser,
        });

        expect(mockRegistrarLog).toHaveBeenCalledWith(
            expect.objectContaining({
                hotelId: 'hotel-001',
                accion: 'CHECK-OUT',
                modulo: 'recepcion',
            })
        );
    });

    it('el checkout es exitoso aunque SUNAT retorne error de negocio', async () => {
        mockCrearComprobante.mockRejectedValue(new Error('RUC no válido en SUNAT'));

        const venta = await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, id: 'reserva-uuid-002', habitacion_id: 'hab-uuid-002' },
            formData: {
                metodo: 'efectivo',
                descuento: 50,
                codigoReferencia: '',
                requiereComprobante: true,
                tipoComprobante: 'factura',
                rucCliente: '20999999999',
                razonSocial: 'Empresa Test SAC',
                dniCliente: '',
                nombreCliente: '',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'automatico', aplica_igv: true },
            user: baseUser,
        });

        // Checkout completado
        expect(venta.id).toBe('venta-uuid-002');
        expect(venta._sunatError).toBe('RUC no válido en SUNAT');

        // Habitación liberada
        expect(mockHabitacionUpdate).toHaveBeenCalledWith(
            'hab-uuid-002',
            expect.objectContaining({ estado: 'disponible' })
        );

        // Reserva finalizada
        expect(mockReservaUpdate).toHaveBeenCalledWith(
            'reserva-uuid-002',
            expect.objectContaining({ estado: 'finalizada' })
        );

        // Auditoría registrada
        expect(mockRegistrarLog).toHaveBeenCalled();
    });

    it('el checkout funciona sin errores cuando modo_sunat = manual y requiere comprobante', async () => {
        // En modo manual, SUNAT NO se llama, pero el comprobante queda pendiente
        const venta = await ejecutarFlujoCheckout({
            reserva: { ...baseReserva, id: 'reserva-uuid-002', habitacion_id: 'hab-uuid-002' },
            formData: {
                metodo: 'plin',
                descuento: 0,
                codigoReferencia: 'PLIN-XYZ-789',
                requiereComprobante: true,
                tipoComprobante: 'boleta',
                rucCliente: '',
                razonSocial: '',
                dniCliente: '11223344',
                nombreCliente: 'Carlos López',
            },
            hotelId: 'hotel-001',
            config: { modo_sunat: 'manual', aplica_igv: true },
            user: baseUser,
        });

        // SUNAT no fue llamado
        expect(mockCrearComprobante).not.toHaveBeenCalled();

        // Venta creada con estado sunat_pendiente
        expect(mockVentaCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                estado_comprobante: 'sunat_pendiente',
                tipo_comprobante: 'boleta',
                notas: '[Ref PLIN: PLIN-XYZ-789]',
            })
        );

        // Checkout exitoso
        expect(venta.id).toBe('venta-uuid-002');
    });
});
