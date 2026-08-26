import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { supabase } from '@/config/supabase';
import { useHotel } from '@/contexts/HotelContext';
import { toast } from 'sonner';
import { useCheckout } from '@/hooks/useCheckout';
import { useAuth } from '@/contexts/AuthContext';
import {
    METODOS_CON_REFERENCIA,
    calcularTotal,
    calcularIGV,
    validarComprobante,
    validarReferenciaYapePlin,
} from '@/services/checkout.service';
import { useLoyaltyAccount } from '@/hooks/useLoyalty';
import { canRedeemSimpleDiscount, calculateSimpleRoomDiscount } from '@/services/loyalty.service';

export function useRegistrarVenta({ reserva, onClose, onSuccess }) {
    const { hotelActual } = useHotel();
    const { user } = useAuth();
    const hotelId = hotelActual?.id;
    
    const [descuento, setDescuento] = useState(0);
    const [requiereComprobante, setRequiereComprobante] = useState(false);
    const [redimirPuntos, setRedimirPuntos] = useState(false);
    const [metodo, setMetodo] = useState('efectivo');
    const [tipoComprobante, setTipoComprobante] = useState('boleta');
    const [rucCliente, setRucCliente] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [dniCliente, setDniCliente] = useState(reserva.huesped_dni || '');
    const [nombreCliente, setNombreCliente] = useState(reserva.huesped_nombre || '');
    const [codigoReferencia, setCodigoReferencia] = useState('');

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => db.entities.ConfigHotel.filter({ id: hotelId }),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    const [qrDinamico, setQrDinamico] = useState(null);
    const [generandoQR, setGenerandoQR] = useState(false);
    const [esperandoWebhook, setEsperandoWebhook] = useState(false);
    const [webhookSuccess, setWebhookSuccess] = useState(false);

    const { data: loyaltyAccount } = useLoyaltyAccount(hotelId, dniCliente || reserva.huesped_dni);

    const isLoyaltyEnabled = config.loyalty_program_enabled === true;
    const canRedeem = isLoyaltyEnabled && canRedeemSimpleDiscount(loyaltyAccount?.points_balance || 0, reserva.habitacion_tipo);
    const descuentoPuntos = (canRedeem && redimirPuntos) ? calculateSimpleRoomDiscount(reserva.precio_noche || 0, reserva.noches || 1) : 0;
    const descuentoTotal = Number(descuento || 0) + descuentoPuntos;

    const totalConsumos = Math.max(
        0,
        Number(reserva.total || 0) - Number(reserva.precio_noche || 0) * Number(reserva.noches || 1)
    );
    const totalCalc = calcularTotal({
        precio_noche: reserva.precio_noche || 0,
        noches: reserva.noches || 1,
        total_consumos: totalConsumos,
        descuento: descuentoTotal,
    });
    const igvCalc = calcularIGV(totalCalc.total_final, config.aplica_igv !== false);

    useEffect(() => {
        if (config.modo_sunat === 'automatico') {
            setRequiereComprobante(true);
        }
    }, [config.modo_sunat]);

    useEffect(() => {
        if (!esperandoWebhook) return;
        
        const channel = supabase
            .channel(`webhook_reserva_${reserva.id}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'reservas', filter: `id=eq.${reserva.id}` },
                (payload) => {
                    if (payload.new.estado_pago === 'pagado') {
                        setWebhookSuccess(true);
                        setEsperandoWebhook(false);
                        import('canvas-confetti').then((confetti) => {
                            confetti.default({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                        });
                        setTimeout(() => {
                            onSuccess();
                            onClose();
                        }, 3000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [esperandoWebhook, reserva.id, onClose, onSuccess]);

    const handleGenerarQR = async () => {
        setGenerandoQR(true);
        try {
            const { data, error } = await supabase.functions.invoke('generate-payment', {
                body: { 
                    reserva_id: reserva.id, 
                    pasarela: config.pasarela_activa || 'culqi'
                }
            });
            if (error) {
                let detail = error.message;
                try { detail = (await error.context?.json())?.error || detail; } catch { }
                throw new Error(detail);
            }
            if (data?.qrUrl) {
                setQrDinamico(data.qrUrl);
                setEsperandoWebhook(true);
            } else {
                throw new Error(data?.error || 'La pasarela no devolvió una orden de pago verificable');
            }
        } catch (error) {
            console.error('Pago automático no disponible:', error);
            toast.error(error?.message || 'Pago automático no disponible.');
        } finally {
            setGenerandoQR(false);
        }
    };

    const formData = {
        metodo,
        descuento: descuentoTotal,
        codigoReferencia,
        requiereComprobante,
        tipoComprobante,
        rucCliente,
        razonSocial,
        dniCliente,
        nombreCliente,
        redimirPuntos: redimirPuntos && canRedeem,
    };

    const checkoutIssue = (() => {
        if (config.modo_automatico && METODOS_CON_REFERENCIA.includes(metodo)) {
            if (webhookSuccess) return 'Pago confirmado. Cerrando la operación…';
            return qrDinamico ? 'Esperando la confirmación automática del pago.' : 'Genera el QR para continuar con el pago.';
        }

        const referenceValidation = validarReferenciaYapePlin({ metodo, codigoReferencia });
        if (!referenceValidation.valido) return referenceValidation.error;

        if (requiereComprobante) {
            const receiptValidation = validarComprobante({
                tipo: tipoComprobante,
                ruc: rucCliente,
                razonSocial,
                dni: dniCliente,
                nombre: nombreCliente,
            });
            if (!receiptValidation.valido) return receiptValidation.errors[0];
        }

        return null;
    })();

    const {
        registrarPago,
        isPending,
        ventaCreada,
    } = useCheckout({
        reserva,
        formData,
        hotelId,
        config: {
            modo_sunat: config.modo_sunat,
            aplica_igv: config.aplica_igv !== false,
            loyalty_program_enabled: config.loyalty_program_enabled === true,
        },
        user,
    });

    const successHandledRef = useRef(false);
    useEffect(() => {
        if (!ventaCreada) {
            successHandledRef.current = false;
            return;
        }
        if (successHandledRef.current) return;
        successHandledRef.current = true;

        if (ventaCreada._sunatError) {
            toast.success('Pago registrado localmente (SUNAT pendiente)');
        } else if (config.modo_sunat === 'automatico' && requiereComprobante) {
            toast.success('Comprobante emitido con éxito en SUNAT');
        } else {
            toast.success('Pago registrado correctamente');
        }
    }, [ventaCreada, config.modo_sunat, requiereComprobante]);

    return {
        state: {
            hotelActual,
            descuento, setDescuento,
            requiereComprobante, setRequiereComprobante,
            redimirPuntos, setRedimirPuntos,
            metodo, setMetodo,
            tipoComprobante, setTipoComprobante,
            rucCliente, setRucCliente,
            razonSocial, setRazonSocial,
            dniCliente, setDniCliente,
            nombreCliente, setNombreCliente,
            codigoReferencia, setCodigoReferencia,
            config,
            qrDinamico, generandoQR, webhookSuccess,
            loyaltyAccount, isLoyaltyEnabled, canRedeem, descuentoPuntos, descuentoTotal,
            totalConsumos, totalCalc, igvCalc,
            checkoutIssue, isPending, ventaCreada
        },
        actions: {
            handleGenerarQR,
            registrarPago
        }
    };
}
