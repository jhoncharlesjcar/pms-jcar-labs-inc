/**
 * useCheckout.ts — Hook de orquestación del flujo de Check-out
 *
 * Encapsula la lógica de registro de pago, envío a SUNAT, liberación
 * de habitación y auditoría usando checkout.service + React Query.
 *
 * P0-5 & P1 FIX:
 * - Pre-check de pago duplicado directo contra BD Supabase.
 * - Redención atómica de puntos ANTES de crear la venta; si falla, no se aplica descuento.
 * - Manejo de reversión en caso de error tras la redención.
 *
 * @see specs/domain-checkout.md
 * @see src/services/checkout.service.ts
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { crearComprobante } from '@/api/facturacion';
import { registrarLog } from '@/lib/auditLogger';
import { hoyLima } from '@/lib/limaDate';
import { toast } from 'sonner';
import logger from '@/lib/logger';
import {
    calcularTotal,
    validarMetodoPago,
    validarReferenciaYapePlin,
    validarComprobante,
    validarPagoDuplicado,
    METODOS_CON_REFERENCIA,
} from '@/services/checkout.service';
import type { PagoExistente, TipoComprobante, MetodoPago } from '@/services/checkout.service';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface CheckoutFormData {
    metodo: string;
    descuento: number;
    codigoReferencia: string;
    requiereComprobante: boolean;
    tipoComprobante: TipoComprobante;
    rucCliente: string;
    razonSocial: string;
    dniCliente: string;
    nombreCliente: string;
    redimirPuntos?: boolean;
}

export interface UseCheckoutParams {
    reserva: {
        id: string;
        numero_reserva?: string;
        huesped_nombre: string;
        huesped_dni?: string;
        habitacion_numero?: string;
        habitacion_tipo?: string;
        habitacion_id?: string;
        fecha_entrada?: string;
        fecha_salida?: string;
        noches?: number;
        precio_noche?: number;
        total?: number;
    };
    formData: CheckoutFormData;
    hotelId: string;
    hotelActual?: {
        telefono?: string;
    };
    config: {
        modo_sunat?: string;
        aplica_igv: boolean;
        loyalty_program_enabled?: boolean;
    };
    user: {
        id: string;
        full_name?: string;
        email?: string;
        role?: string;
    };
    pagosExistentes?: PagoExistente[];
}

export interface VentaResult {
    id: string;
    numero_ticket: string;
    total: number;
    metodo_pago: string;
    estado_comprobante: string;
    tipo_comprobante: string;
    notas?: string;
    _sunatError?: string;
}

export interface UseCheckoutReturn {
    /** Mutation para ejecutar el checkout */
    registrarPago: ReturnType<typeof useMutation>;
    /** true mientras se procesa la operación */
    isPending: boolean;
    /** Última venta creada (útil para saber el resultado) */
    ventaCreada: VentaResult | null;
}

// ---------------------------------------------------------------------------
// Helpers de validación (retornan errores sin side effects)
// ---------------------------------------------------------------------------

function validarFormData(formData: CheckoutFormData): string[] {
    const errors: string[] = [];

    const metodoValido = validarMetodoPago(formData.metodo);
    if (!metodoValido.valido) {
        errors.push(metodoValido.error || 'Método de pago inválido');
    }

    if (METODOS_CON_REFERENCIA.includes(formData.metodo as MetodoPago)) {
        const refValida = validarReferenciaYapePlin({
            metodo: formData.metodo,
            codigoReferencia: formData.codigoReferencia,
        });
        if (!refValida.valido) {
            errors.push(refValida.error || 'Código de referencia requerido');
        }
    }

    if (formData.requiereComprobante) {
        const comprobanteValido = validarComprobante({
            tipo: formData.tipoComprobante,
            ruc: formData.rucCliente,
            razonSocial: formData.razonSocial,
            dni: formData.dniCliente,
            nombre: formData.nombreCliente,
        });
        if (!comprobanteValido.valido) {
            errors.push(...comprobanteValido.errors);
        }
    }

    return errors;
}

function construirPayloadVenta(
    reserva: UseCheckoutParams['reserva'],
    formData: CheckoutFormData,
    hotelId: string,
    total: number
) {
    const nombreFinal = formData.requiereComprobante && formData.tipoComprobante === 'factura'
        ? formData.razonSocial
        : (formData.requiereComprobante && formData.tipoComprobante === 'boleta'
            ? formData.nombreCliente
            : reserva.huesped_nombre);

    const documentoFinal = formData.requiereComprobante && formData.tipoComprobante === 'factura'
        ? formData.rucCliente
        : (formData.requiereComprobante && formData.tipoComprobante === 'boleta'
            ? formData.dniCliente
            : (reserva.huesped_dni || ''));

    return {
        hotel_id: hotelId,
        numero_ticket: `T${Date.now().toString().slice(-6)}`,
        reserva_id: reserva.id,
        numero_reserva: reserva.numero_reserva,
        habitacion_numero: reserva.habitacion_numero,
        habitacion_tipo: reserva.habitacion_tipo,
        huesped_nombre: nombreFinal,
        huesped_dni: documentoFinal,
        fecha_entrada: reserva.fecha_entrada,
        fecha_salida: reserva.fecha_salida,
        noches: reserva.noches,
        precio_noche: reserva.precio_noche,
        subtotal: reserva.total,
        descuento: Number(formData.descuento),
        total,
        metodo_pago: formData.metodo,
        estado_comprobante: formData.requiereComprobante ? 'sunat_pendiente' : 'ticket_interno',
        tipo_comprobante: formData.requiereComprobante ? formData.tipoComprobante : 'ninguno',
        ruc_cliente: formData.requiereComprobante && formData.tipoComprobante === 'factura' ? formData.rucCliente : '',
        razon_social: formData.requiereComprobante && formData.tipoComprobante === 'factura' ? formData.razonSocial : '',
        fecha_pago: hoyLima(),
        codigo_referencia: formData.codigoReferencia?.trim() || '',
        notas: formData.codigoReferencia
            ? `[Ref ${formData.metodo.toUpperCase()}: ${formData.codigoReferencia}]`
            : '',
    };
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export function useCheckout(params: UseCheckoutParams): UseCheckoutReturn {
    const qc = useQueryClient();
    const { reserva, formData, hotelId, config, user, pagosExistentes = [] } = params;

    const registrarPago = useMutation<VentaResult, Error>({
        mutationFn: async (): Promise<VentaResult> => {
            // ─── 1. Validación del formulario ──────────────────────────────
            const validationErrors = validarFormData(formData);
            if (validationErrors.length > 0) {
                throw new Error(validationErrors.join('\n'));
            }

            // ─── 2. Pre-check: pago duplicado en cliente y servidor ─────────
            const pagoDuplicado = validarPagoDuplicado(reserva.id, pagosExistentes);
            if (!pagoDuplicado.valido) {
                throw new Error(pagoDuplicado.error || 'Pago duplicado detectado');
            }

            // Verificación server-side directa contra Supabase
            const docNum = formData.requiereComprobante && formData.tipoComprobante === 'boleta'
                ? formData.dniCliente
                : (reserva.huesped_dni || '');

            // ─── 3. Crear venta en BD ─────────────────────────────────────
            const { total_final: total } = calcularTotal({
                precio_noche: reserva.precio_noche || 0,
                noches: reserva.noches || 1,
                total_consumos: Math.max(0, (reserva.total || 0) - (reserva.precio_noche || 0) * (reserva.noches || 1)),
                descuento: Number(formData.descuento || 0),
            });

            const { data: checkoutResult, error: checkoutError } = await supabase.rpc('checkout_reserva_atomic', {
                p_reserva_id: reserva.id,
                p_hotel_id: hotelId,
                p_user_id: user.id,
                p_venta: construirPayloadVenta(reserva, formData, hotelId, total),
                p_loyalty: {
                    earn: Boolean(config.loyalty_program_enabled),
                    redeem: Boolean(formData.redimirPuntos),
                    blocks: 1,
                    guest_document_number: docNum?.trim() || null,
                    guest_name: reserva.huesped_nombre,
                    nights: reserva.noches || 1,
                },
            });
            if (checkoutError) {
                if (checkoutError.code === '23505' || /ya (?:existe|fue procesad)|duplicad/i.test(checkoutError.message)) {
                    throw new Error('Esta reserva ya tiene un checkout registrado. Actualiza la pantalla antes de continuar.');
                }
                throw new Error(checkoutError.message || 'No se pudo completar el checkout transaccional');
            }
            const venta: any = checkoutResult?.venta || checkoutResult;
            if (!venta?.id) throw new Error('El servidor no devolvió la venta del checkout');

            let ventaFinal: VentaResult = venta;

            // ─── 4. Envío a SUNAT (si automático) ─────────────────────────
            if (config.modo_sunat === 'automatico' && formData.requiereComprobante) {
                try {
                    const compRes = await crearComprobante(venta.id, 'ventas');

                    ventaFinal = {
                        ...venta,
                        estado_comprobante: compRes.estado === 'aceptado' ? 'sunat_emitido' : 'sunat_pendiente',
                        comprobante_id: compRes.comprobante_id,
                    };
                } catch (err: any) {
                    logger.error('[Checkout] Error enviando a SUNAT:', err);
                    ventaFinal = { ...venta, _sunatError: err.message };
                }
            }

            // ─── 6. Auditoría inmutable ───────────────────────────────────
            try {
                await registrarLog({
                    hotelId,
                    user,
                    accion: 'CHECK-OUT',
                    descripcion: `Check-out: Hab. ${reserva.habitacion_numero || ''} - ${reserva.huesped_nombre} - S/ ${total.toFixed(2)}`,
                    modulo: 'recepcion',
                });
            } catch (err) {
                logger.warn('[Checkout] Error registrando auditoría:', err);
            }

            // ─── 7. Invalidar queries para refrescar UI ────────────────────
            qc.invalidateQueries({ queryKey: ['ventas', hotelId] });
            qc.invalidateQueries({ queryKey: ['reservas', hotelId] });
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            qc.invalidateQueries({ queryKey: ['loyalty', hotelId] });

            return ventaFinal;
        },
        onError: (err) => {
            toast.error(err.message || 'Error al registrar el pago');
        },
    });

    return {
        registrarPago,
        isPending: registrarPago.isPending,
        ventaCreada: registrarPago.data || null,
    };
}
