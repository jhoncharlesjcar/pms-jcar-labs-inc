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
import { db } from '@/api/db';
import { supabase } from '@/config/supabase';
import { crearComprobante } from '@/api/facturacion';
import { registrarLog } from '@/lib/auditLogger';
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
import { redeemPointsOnCheckout, accumulatePointsOnCheckout, reversePointsOnCancellation } from '@/services/loyalty.service';

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
        fecha_pago: new Date().toLocaleDateString('sv-SE'),
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
            if (reserva.id) {
                const { data: existingVenta, error: checkError } = await supabase
                    .from('ventas')
                    .select('id')
                    .eq('reserva_id', reserva.id)
                    .maybeSingle();

                if (!checkError && existingVenta) {
                    throw new Error('Ya existe una venta registrada para esta reserva en el servidor');
                }
            }

            // ─── 2.5. P0-5 FIX: Redención atómica de puntos ANTES de crear la venta ──
            const docNum = formData.requiereComprobante && formData.tipoComprobante === 'boleta'
                ? formData.dniCliente
                : (reserva.huesped_dni || '');

            let pointsRedeemed = false;
            if (formData.redimirPuntos && config.loyalty_program_enabled && docNum?.trim()) {
                try {
                    await redeemPointsOnCheckout({
                        hotelId,
                        guestDocumentNumber: docNum.trim(),
                        reservaId: reserva.id,
                        userId: user.id,
                    });
                    pointsRedeemed = true;
                } catch (err: any) {
                    logger.error('[Checkout] Fallo al redimir puntos de fidelidad:', err);
                    throw new Error(`Error en fidelización: ${err.message || 'No se pudieron redimir los puntos'}`);
                }
            }

            // ─── 3. Crear venta en BD ─────────────────────────────────────
            const { total_final: total } = calcularTotal({
                precio_noche: reserva.precio_noche || 0,
                noches: reserva.noches || 1,
                total_consumos: Math.max(0, (reserva.total || 0) - (reserva.precio_noche || 0) * (reserva.noches || 1)),
                descuento: Number(formData.descuento || 0),
            });

            let venta: any;
            try {
                venta = await db.entities.Venta.create(
                    construirPayloadVenta(reserva, formData, hotelId, total)
                );
            } catch (createErr: any) {
                // Si la venta falla y habíamos redimido puntos, intentamos revertir
                if (pointsRedeemed && docNum?.trim()) {
                    try {
                        await reversePointsOnCancellation({
                            hotelId,
                            guestDocumentNumber: docNum.trim(),
                            reservaId: reserva.id,
                            userId: user.id,
                        });
                    } catch (revErr) {
                        logger.error('[Checkout] Error revirtiendo puntos tras fallo de venta:', revErr);
                    }
                }
                throw createErr;
            }

            let ventaFinal: VentaResult = venta;

            // ─── 4. Envío a SUNAT (si automático) ─────────────────────────
            if (config.modo_sunat === 'automatico' && formData.requiereComprobante) {
                try {
                    const compRes = await crearComprobante(venta.id, 'ventas');

                    const updatedVenta = await db.entities.Venta.update(venta.id, {
                        estado_comprobante: 'sunat_emitido',
                        notas: `${venta.notas || ''} [SUNAT: ${compRes.estado || 'Emitido'}]`.trim(),
                    });
                    ventaFinal = updatedVenta;
                } catch (err: any) {
                    logger.error('[Checkout] Error enviando a SUNAT:', err);
                    ventaFinal = { ...venta, _sunatError: err.message };
                }
            }

            // ─── 5. Liberar habitación (CHECKOUT-003) ─────────────────────
            try {
                if (reserva.habitacion_id) {
                    await Promise.all([
                        db.entities.Reserva.update(reserva.id, { estado: 'finalizada' }),
                        db.entities.Habitacion.update(reserva.habitacion_id, { estado: 'limpieza' }),
                    ]);
                }
            } catch (err) {
                logger.error('[Checkout] Error enviando habitación a limpieza:', err);
                // No bloquear: la venta ya está registrada
            }

            // ─── 5.1. Acumular Puntos de Fidelización (Reglas 1, 2) ────────
            try {
                if (config.loyalty_program_enabled && docNum && docNum.trim().length > 0) {
                    await accumulatePointsOnCheckout({
                        hotelId,
                        guestDocumentNumber: docNum.trim(),
                        guestName: reserva.huesped_nombre,
                        nights: reserva.noches || 1,
                        reservaId: reserva.id,
                        userId: user.id,
                    });
                }
            } catch (err) {
                logger.error('[Checkout] Error acumulando puntos de fidelidad tras venta:', err);
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
