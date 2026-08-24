import { useState, useEffect, useRef, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CircleAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useHotel } from '@/contexts/HotelContext';
import { toast } from 'sonner';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';

// ─── Orquestación (servicio de dominio) ────────────────────────────────────
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

// ─── Subcomponentes extraídos ───────────────────────────────────────────────
import { ResumenCuenta } from '@/components/checkout/ResumenCuenta';
import { FormaPagoSelector, METODOS_UI } from '@/components/checkout/FormaPagoSelector';
import { FidelidadCard } from '@/components/checkout/FidelidadCard';
import { ComprobanteSelector } from '@/components/checkout/ComprobanteSelector';
import { VentaExitosaDialog } from '@/components/checkout/VentaExitosaDialog';

const RegistrarVentaModal = memo(function RegistrarVentaModal(/** @type {any} */ { reserva, onClose, onSuccess }) {
    const { hotelActual } = useHotel();
    const { user } = useAuth();
    const hotelId = hotelActual?.id;
    
    // State missing from original code added here:
    const [descuento, setDescuento] = useState(0);
    const [requiereComprobante, setRequiereComprobante] = useState(false);
    const [redimirPuntos, setRedimirPuntos] = useState(false);

    const initialMetodo = /** @type {import('@/constants/paymentMethods').MetodoPago} */ ('efectivo');
    const [metodo, setMetodo] = useState(initialMetodo);
    const initialTipoComprobante = /** @type {import('@/constants/comprobantes').TipoComprobante} */ ('boleta');
    const [tipoComprobante, setTipoComprobante] = useState(initialTipoComprobante);
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

    // ─── Total parcial (solo para preview en UI) ───────────────────────
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

    // Auto-activar comprobante si el modo SUNAT es automático
    useEffect(() => {
        if (config.modo_sunat === 'automatico') {
            setRequiereComprobante(true);
        }
    }, [config.modo_sunat]);

    // ─── Webhook Listener (Modo Automático) ──────────────────────────────
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
                try { detail = (await error.context?.json())?.error || detail; } catch { /* respuesta no JSON */ }
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
            toast.error(error?.message || 'Pago automático no disponible. Usa un método manual.');
        } finally {
            setGenerandoQR(false);
        }
    };

    // ─── Formulario normalizado para el hook de dominio ────────────────────
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

    // ─── Hook de orquestación ──────────────────────────────────────────────
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

    // ─── Manejar éxito de la mutación ──────────────────────────────────────
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

    if (ventaCreada) {
        return (
            <VentaExitosaDialog 
                ventaCreada={ventaCreada} 
                config={config} 
                reserva={reserva} 
                onClose={onClose} 
                onSuccess={onSuccess} 
            />
        );
    }

    return (
        <Sheet open onOpenChange={onClose}>
            <SheetContent side="right" className="flex h-[100dvh] w-full flex-col overflow-hidden border-l border-border/80 p-0 shadow-2xl glass-panel sm:max-w-lg">
                <div className="shrink-0 border-b border-border/70 bg-background/95 p-4 pr-12 backdrop-blur sm:p-5 sm:pr-12">
                    <SheetHeader className="space-y-1 text-left">
                        <SheetTitle className="font-semibold text-base text-foreground">Registrar Cobro — Hab. #{reserva.habitacion_numero}</SheetTitle>
                        <p className="text-xs text-muted-foreground">Revisa la cuenta antes de confirmar la liquidación.</p>
                    </SheetHeader>
                    <div className="mt-4">
                        <CheckoutProgress current="payment" />
                    </div>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
                    <ResumenCuenta 
                        reserva={reserva} 
                        totalConsumos={totalConsumos} 
                        totalCalc={totalCalc} 
                        igvCalc={igvCalc} 
                    />

                    <FormaPagoSelector 
                        metodo={metodo} 
                        setMetodo={setMetodo} 
                        descuento={descuento} 
                        setDescuento={setDescuento} 
                        config={config} 
                        METODOS_CON_REFERENCIA={METODOS_CON_REFERENCIA} 
                        webhookSuccess={webhookSuccess} 
                        qrDinamico={qrDinamico} 
                        generandoQR={generandoQR} 
                        handleGenerarQR={handleGenerarQR} 
                        totalCalc={totalCalc} 
                        hotelActual={hotelActual} 
                        codigoReferencia={codigoReferencia} 
                        setCodigoReferencia={setCodigoReferencia} 
                    />

                    <FidelidadCard 
                        isLoyaltyEnabled={isLoyaltyEnabled} 
                        loyaltyAccount={loyaltyAccount} 
                        canRedeem={canRedeem} 
                        redimirPuntos={redimirPuntos} 
                        setRedimirPuntos={setRedimirPuntos} 
                        descuentoPuntos={descuentoPuntos} 
                        reserva={reserva} 
                    />

                    <ComprobanteSelector 
                        requiereComprobante={requiereComprobante} 
                        setRequiereComprobante={setRequiereComprobante} 
                        tipoComprobante={tipoComprobante} 
                        setTipoComprobante={setTipoComprobante} 
                        dniCliente={dniCliente} 
                        setDniCliente={setDniCliente} 
                        nombreCliente={nombreCliente} 
                        setNombreCliente={setNombreCliente} 
                        rucCliente={rucCliente} 
                        setRucCliente={setRucCliente} 
                        razonSocial={razonSocial} 
                        setRazonSocial={setRazonSocial} 
                        config={config} 
                    />
                </div>

                <div className="shrink-0 border-t border-border/70 bg-background/95 p-3 backdrop-blur sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total a cobrar</p>
                            <p className="text-2xl font-bold tabular-nums text-primary">S/ {totalCalc.total_final.toFixed(2)}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                            <p className="font-semibold capitalize text-foreground">{METODOS_UI.find(item => item.value === metodo)?.label}</p>
                            <p>{requiereComprobante ? tipoComprobante : 'Ticket interno'}</p>
                        </div>
                    </div>
                    {checkoutIssue && (
                        <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400" role="status">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {checkoutIssue}
                        </p>
                    )}
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                        <Button variant="outline" className="h-11 rounded-lg px-4" disabled={isPending} onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            className="h-11 rounded-lg text-sm font-semibold shadow-md shadow-primary/15"
                            disabled={isPending || !!checkoutIssue}
                            onClick={() => registrarPago.mutate()}
                        >
                            {isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</> : `Confirmar cobro · S/ ${totalCalc.total_final.toFixed(2)}`}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
});
RegistrarVentaModal.displayName = 'RegistrarVentaModal';
export default RegistrarVentaModal;
