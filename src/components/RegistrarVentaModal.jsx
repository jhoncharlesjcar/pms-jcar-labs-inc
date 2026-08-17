// @ts-nocheck
import { useState, useEffect, useRef, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, ExternalLink, Award, Loader2, BedDouble, CircleAlert, ReceiptText, ShieldCheck } from 'lucide-react';
import { supabase } from '@/config/supabase';
import TicketPDF from '@/components/TicketPDF';
import { useHotel } from '@/contexts/HotelContext';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';
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
import { isSimpleRoomType, canRedeemSimpleDiscount, calculateSimpleRoomDiscount, calculateEarnedPoints } from '@/services/loyalty.service';

// ─── Constantes de UI (solo visual) ────────────────────────────────────────
const METODOS_UI = [
    { value: 'efectivo', label: 'Efectivo', icon: EfectivoIcon },
    { value: 'yape', label: 'Yape', icon: YapeIcon },
    { value: 'plin', label: 'Plin', icon: PlinIcon },
    { value: 'transferencia', label: 'Transferencia', icon: ReceiptText },
    { value: 'tarjeta', label: 'Tarjeta', icon: TarjetaIcon },
];


/**
 * @param {{ reserva: any, onClose: function, onSuccess: function }} props
 */
const RegistrarVentaModal = memo(function RegistrarVentaModal({ reserva, onClose, onSuccess }) {
    const { hotelActual } = useHotel();
    const { user } = useAuth();
    const hotelId = hotelActual?.id;
    /** @type {any} */
    const initialMetodo = 'efectivo';
    const [metodo, setMetodo] = useState(initialMetodo);
    const [descuento, setDescuento] = useState(0);
    const [redimirPuntos, setRedimirPuntos] = useState(false);
    const [requiereComprobante, setRequiereComprobante] = useState(false);
    /** @type {any} */
    const initialTipoComprobante = 'boleta';
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
            logger.error('Pago automático no disponible:', error);
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

    const abrirSunat = () => {
        window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank');
    };

    if (ventaCreada) {
        return (
            <Dialog open onOpenChange={onClose}>
                <DialogContent className="max-w-md overflow-y-auto p-4 sm:p-6 rounded-none sm:rounded-xl border border-border/80 shadow-xl glass-panel max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0">
                    <DialogHeader className="space-y-4 text-left">
                        <CheckoutProgress current="complete" />
                        <DialogTitle className="flex items-center gap-2 text-emerald-700 font-semibold text-base dark:text-emerald-400">
                            <CheckCircle className="w-5 h-5" /> Pago registrado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="text-center space-y-4">
                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                            <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">S/ {Number(ventaCreada.total || 0).toFixed(2)}</p>
                            <p className="mt-1 text-xs font-medium capitalize text-emerald-700/80 dark:text-emerald-400/80">Ticket #{ventaCreada.numero_ticket} · {ventaCreada.metodo_pago}</p>
                            <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-background/70 px-3 py-2 text-xs font-semibold text-foreground">
                                <BedDouble className="h-4 w-4 text-violet-500" />
                                Habitación #{reserva.habitacion_numero} enviada a limpieza
                            </div>
                        </div>

                        <TicketPDF venta={ventaCreada} config={config} />

                        {ventaCreada.estado_comprobante === 'sunat_pendiente' && (
                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-left">
                                <p className="text-sm font-semibold text-blue-800 mb-2">El cliente solicitó comprobante SUNAT</p>
                                <p className="text-xs text-blue-600 mb-3">Ingresa al portal de SUNAT para emitir la {ventaCreada.tipo_comprobante}</p>
                                <Button onClick={abrirSunat} className="w-full h-10 rounded-lg gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                                    <ExternalLink className="w-4 h-4" /> Ir a Portal SUNAT
                                </Button>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button className="flex-1 h-11 rounded-lg text-sm font-semibold" onClick={() => { onSuccess(); onClose(); }}>
                                Finalizar checkout
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
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
                    <section aria-labelledby="checkout-resumen" className="space-y-3">
                        <div className="flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-primary" />
                            <h3 id="checkout-resumen" className="text-sm font-semibold text-foreground">Resumen de la cuenta</h3>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm">
                            <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-foreground">{reserva.huesped_nombre}</p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">Habitación #{reserva.habitacion_numero} · {reserva.habitacion_tipo}</p>
                                </div>
                                <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold">{reserva.noches} {reserva.noches === 1 ? 'noche' : 'noches'}</span>
                            </div>
                            <div className="space-y-2 pt-3">
                                <div className="flex justify-between gap-4">
                                    <span className="text-muted-foreground">Estadía · S/ {Number(reserva.precio_noche || 0).toFixed(2)} × {reserva.noches}</span>
                                    <span className="font-semibold tabular-nums">S/ {totalCalc.total_estadia.toFixed(2)}</span>
                                </div>
                                {totalConsumos > 0 && (
                                    <div className="flex justify-between gap-4">
                                        <span className="text-muted-foreground">Consumos adicionales</span>
                                        <span className="font-semibold tabular-nums">S/ {totalConsumos.toFixed(2)}</span>
                                    </div>
                                )}
                                {totalCalc.descuento > 0 && (
                                    <div className="flex justify-between gap-4 text-rose-600 dark:text-rose-400">
                                        <span>Descuento aplicado</span>
                                        <span className="font-semibold tabular-nums">-S/ {totalCalc.descuento.toFixed(2)}</span>
                                    </div>
                                )}
                                {igvCalc.igv > 0 && (
                                    <>
                                        <div className="flex justify-between gap-4 border-t border-border/40 pt-2 text-xs">
                                            <span className="text-muted-foreground">Base imponible</span>
                                            <span className="font-semibold tabular-nums">S/ {igvCalc.base_imponible.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 text-xs">
                                            <span className="text-muted-foreground">IGV (18%)</span>
                                            <span className="font-semibold tabular-nums">S/ {igvCalc.igv.toFixed(2)}</span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </section>

                    <section aria-labelledby="checkout-pago" className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                <h3 id="checkout-pago" className="text-sm font-semibold text-foreground">Forma de pago</h3>
                            </div>
                            <span className="text-[11px] font-medium text-muted-foreground">Selecciona una opción</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Método de pago">
                            {METODOS_UI.map(paymentMethod => {
                                const PaymentIcon = paymentMethod.icon;
                                const selected = metodo === paymentMethod.value;
                                return (
                                    <button
                                        key={paymentMethod.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => setMetodo(paymentMethod.value)}
                                        className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold transition-colors ${selected ? 'border-primary/40 bg-primary/10 text-primary ring-1 ring-primary/15' : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'}`}
                                    >
                                        <PaymentIcon className="h-4 w-4" />
                                        <span className="truncate">{paymentMethod.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="checkout-discount" className="text-[11px] font-semibold text-muted-foreground">Descuento manual (S/)</Label>
                            <Input id="checkout-discount" type="number" min={0} value={descuento} onChange={e => setDescuento(Math.max(0, Number(e.target.value)))} className="h-10 rounded-lg bg-background/60" />
                        </div>
                    </section>

                    {/* Tarjeta de Fidelidad por Puntos (Regla 2 & 6) */}
                    {isLoyaltyEnabled && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-foreground">Fidelización por Puntos</p>
                                        <p className="text-[10px] text-muted-foreground">Saldo actual: <strong className="text-amber-600 dark:text-amber-400">{loyaltyAccount?.points_balance || 0} Pts</strong></p>
                                    </div>
                                </div>
                                {canRedeem && (
                                    <div className="flex items-center gap-2">
                                        <Label htmlFor="redimir-switch" className="text-xs font-bold text-amber-600 dark:text-amber-400 cursor-pointer">
                                            Redimir 100 Pts
                                        </Label>
                                        <Switch
                                            id="redimir-switch"
                                            checked={redimirPuntos}
                                            onCheckedChange={setRedimirPuntos}
                                            className="data-[state=checked]:bg-amber-500"
                                        />
                                    </div>
                                )}
                            </div>
                            {canRedeem && redimirPuntos && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/15 p-2 rounded-lg leading-tight">
                                    ✨ Descuento de S/ {descuentoPuntos.toFixed(2)} aplicado (50% desc. en hab. simple). Se descontarán 100 Pts al cobrar.
                                </p>
                            )}
                            {!canRedeem && (loyaltyAccount?.points_balance || 0) < 100 && (
                                <p className="text-[10px] text-muted-foreground italic">
                                    Se requieren mínimo 100 Pts para redimir descuento (esta estadía otorgará {calculateEarnedPoints(reserva.noches || 1)} Pts).
                                </p>
                            )}
                            {!canRedeem && (loyaltyAccount?.points_balance || 0) >= 100 && !isSimpleRoomType(reserva.habitacion_tipo) && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                    El huésped posee 100+ Pts acumulados pero la recompensa solo aplica a habitaciones simples (Actual: {reserva.habitacion_tipo || 'Doble/Matrimonial'}).
                                </p>
                            )}
                        </div>
                    )}

                    {/* QR Yape / Plin con Confirmación */}
                    {METODOS_CON_REFERENCIA.includes(metodo) && (
                        config.modo_automatico ? (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center space-y-4">
                                {webhookSuccess ? (
                                    <p className="text-emerald-600 font-extrabold text-xl animate-pulse">¡Pago Confirmado Automáticamente! 🎉</p>
                                ) : qrDinamico ? (
                                    <>
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Escanea para pagar</p>
                                        <img src={qrDinamico} alt="QR Dinámico" className="w-40 h-40 mx-auto rounded-lg shadow-md border border-border/50" />
                                        <p className="text-[10px] text-emerald-600 animate-pulse font-bold flex items-center justify-center gap-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Esperando confirmación de {config.pasarela_activa}...
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-[10px] font-bold text-muted-foreground">Se generará un QR dinámico de un solo uso válido por 15 minutos.</p>
                                        <Button onClick={handleGenerarQR} disabled={generandoQR} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md h-12">
                                            {generandoQR ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Generar QR de Pago'}
                                        </Button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center font-bold text-emerald-600">
                                        📱
                                    </div>
                                    <div className="">
                                        <p className="text-sm font-semibold text-foreground">Pago Móvil ({metodo.toUpperCase()})</p>
                                        <p className="text-xs text-muted-foreground">
                                            Modo Manual: El recepcionista debe confirmar.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-center py-2">
                                    <img 
                                        src={
                                            metodo === 'yape' 
                                                ? (config.qr_yape_url || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`YAPE-PLIN-PAYMENT|Monto:S/${totalCalc.total_final.toFixed(2)}|Celular:${hotelActual?.telefono || '987654321'}`)}`) 
                                                : (config.qr_plin_url || `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`YAPE-PLIN-PAYMENT|Monto:S/${totalCalc.total_final.toFixed(2)}|Celular:${hotelActual?.telefono || '987654321'}`)}`)
                                        } 
                                        alt={`QR ${metodo}`} 
                                        className="w-32 h-32 border border-border/50 rounded-lg p-1 bg-white shadow-sm" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">
                                        Código de Operación / Referencia
                                    </Label>
                                    <Input 
                                        value={codigoReferencia} 
                                        onChange={e => setCodigoReferencia(e.target.value)} 
                                        placeholder="Ej. 12345678" 
                                        className="bg-background/50 h-10 rounded-lg border-border/50 focus-visible:ring-emerald-500/30" 
                                    />
                                </div>
                            </div>
                        )
                    )}

                    <section aria-labelledby="checkout-comprobante" className="border border-border rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-primary" />
                            <h3 id="checkout-comprobante" className="text-sm font-semibold text-foreground">Comprobante</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">¿El cliente requiere comprobante electrónico?</p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                aria-pressed={!requiereComprobante}
                                onClick={() => setRequiereComprobante(false)}
                                className={`flex-1 h-10 rounded-lg border text-xs font-semibold transition-[transform,opacity] ${!requiereComprobante ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                            >
                                No — Ticket rápido
                            </button>
                            <button
                                type="button"
                                aria-pressed={requiereComprobante}
                                onClick={() => setRequiereComprobante(true)}
                                className={`flex-1 h-10 rounded-lg border text-xs font-semibold transition-[transform,opacity] ${requiereComprobante ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground'}`}
                            >
                                Sí — Emitir en SUNAT
                            </button>
                        </div>

                        {requiereComprobante && (
                            <div className="space-y-3 pt-1">
                                <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Tipo de comprobante</Label>
                                    <Select value={tipoComprobante} onValueChange={setTipoComprobante}>
                                        <SelectTrigger className="h-10 rounded-lg bg-background/50"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="boleta">Boleta de Venta</SelectItem>
                                            <SelectItem value="factura">Factura</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {tipoComprobante === 'boleta' && (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">DNI / Documento del cliente</Label>
                                            <Input value={dniCliente} onChange={e => setDniCliente(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="DNI, CE o Pasaporte" className="h-10 rounded-lg bg-background/50 font-mono" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Nombre completo</Label>
                                            <Input value={nombreCliente} onChange={e => setNombreCliente(e.target.value)} placeholder="Nombre del cliente" className="h-10 rounded-lg bg-background/50" />
                                        </div>
                                    </>
                                )}
                                {tipoComprobante === 'factura' && (
                                    <>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">RUC del cliente</Label>
                                            <Input value={rucCliente} onChange={e => setRucCliente(e.target.value)} inputMode="numeric" pattern="[0-9]*" placeholder="20XXXXXXXXX" className="h-10 rounded-lg bg-background/50 font-mono" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Razón social</Label>
                                            <Input value={razonSocial} onChange={e => setRazonSocial(e.target.value)} placeholder="Empresa SAC" className="h-10 rounded-lg bg-background/50" />
                                        </div>
                                    </>
                                )}
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
                                    {config.modo_sunat === 'automatico' 
                                        ? 'Se generará y enviará el comprobante electrónico a la SUNAT de forma automática.' 
                                        : 'Al registrar, se marcará como pendiente. Luego podrás emitirlo directamente en el portal de SUNAT.'}
                                </div>
                            </div>
                        )}
                    </section>
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
