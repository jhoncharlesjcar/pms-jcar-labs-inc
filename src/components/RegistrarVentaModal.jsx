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
import { CheckCircle, ExternalLink, Award, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import TicketPDF from '@/components/TicketPDF';
import { useHotel } from '@/lib/HotelContext';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';
import { toast } from 'sonner';

// ─── Orquestación (servicio de dominio) ────────────────────────────────────
import { useCheckout } from '@/hooks/useCheckout';
import { useAuth } from '@/contexts/AuthContext';
import { METODOS_CON_REFERENCIA, calcularTotal, calcularIGV } from '@/services/checkout.service';
import { useLoyaltyAccount } from '@/hooks/useLoyalty';
import { isSimpleRoomType, canRedeemSimpleDiscount, calculateSimpleRoomDiscount, calculateEarnedPoints } from '@/services/loyalty.service';

// ─── Constantes de UI (solo visual) ────────────────────────────────────────
const METODOS_UI = [
    { value: 'efectivo', label: <span className="flex items-center gap-1"><EfectivoIcon /> Efectivo</span> },
    { value: 'yape', label: <span className="flex items-center gap-1"><YapeIcon /> Yape</span> },
    { value: 'plin', label: <span className="flex items-center gap-1"><PlinIcon /> Plin</span> },
    { value: 'transferencia', label: '🏦 Transferencia' },
    { value: 'tarjeta', label: <span className="flex items-center gap-1"><TarjetaIcon /> Tarjeta</span> },
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
    const totalCalc = calcularTotal({
        precio_noche: reserva.precio_noche || 0,
        noches: reserva.noches || 1,
        total_consumos: Math.max(0, (reserva.total || 0) - (reserva.precio_noche || 0) * (reserva.noches || 1)),
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
                    monto: totalCalc.total_final,
                    pasarela: config.pasarela_activa || 'culqi',
                    hotel_id: hotelId
                }
            });
            if (error) throw error;
            if (data?.qrUrl) {
                setQrDinamico(data.qrUrl);
                setEsperandoWebhook(true);
            }
        } catch {
            toast.error('Error generando QR de pasarela');
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
                <DialogContent className="max-w-md p-6 rounded-xl border border-border/80 shadow-xl glass-panel">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-green-700 font-semibold text-base">
                            <CheckCircle className="w-5 h-5" /> Pago Registrado
                        </DialogTitle>
                    </DialogHeader>
                    <div className="text-center space-y-4">
                        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                            <p className="text-2xl font-bold text-green-700">S/ {ventaCreada.total?.toFixed(2)}</p>
                            <p className="text-xs text-green-600">Ticket #{ventaCreada.numero_ticket} · {ventaCreada.metodo_pago}</p>
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
                            <Button variant="outline" className="flex-1 h-10 rounded-lg text-sm font-semibold" onClick={() => { onSuccess(); onClose(); }}>
                                Cerrar
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Sheet open onOpenChange={onClose}>
            <SheetContent side="right" className="sm:max-w-md glass-panel border-l border-border/80 shadow-2xl overflow-y-auto p-6">
                <SheetHeader className="mb-6">
                    <SheetTitle className="font-semibold text-base text-foreground">Registrar Cobro — Hab. #{reserva.habitacion_numero}</SheetTitle>
                </SheetHeader>
                <div className="space-y-6">
                    {/* Resumen */}
                    <div className="bg-secondary/50 border border-border/50 rounded-xl p-4 text-sm space-y-1.5">
                        <div className="flex justify-between"><span className="text-muted-foreground">Huésped</span><span className="font-semibold">{reserva.huesped_nombre}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Habitación</span><span className="font-semibold">#{reserva.habitacion_numero} ({reserva.habitacion_tipo})</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Noches</span><span className="font-semibold">{reserva.noches}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">S/ {reserva.precio_noche} × {reserva.noches}</span><span className="font-semibold">S/ {totalCalc.total_estadia.toFixed(2)}</span></div>
                        {totalCalc.descuento > 0 && (
                            <div className="flex justify-between text-red-500"><span className="text-muted-foreground text-red-400">Descuento</span><span className="font-semibold">-S/ {totalCalc.descuento.toFixed(2)}</span></div>
                        )}
                        {igvCalc.igv > 0 && (
                            <div className="flex justify-between text-xs pt-1 border-t border-border/30 mt-1">
                                <span className="text-muted-foreground">Base imponible</span><span className="font-semibold">S/ {igvCalc.base_imponible.toFixed(2)}</span>
                            </div>
                        )}
                        {igvCalc.igv > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">IGV (18%)</span><span className="font-semibold">S/ {igvCalc.igv.toFixed(2)}</span>
                            </div>
                        )}
                    </div>

                    {/* Descuento */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Descuento Manual (S/)</Label>
                            <Input type="number" min={0} value={descuento} onChange={e => setDescuento(Number(e.target.value))} className="h-10 rounded-lg bg-background/50" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider ml-1">Método de pago</Label>
                            <Select value={metodo} onValueChange={setMetodo}>
                                <SelectTrigger className="h-10 rounded-lg bg-background/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {METODOS_UI.map(m => (
                                        <SelectItem key={m.value} value={m.value} className="capitalize">{m.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

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

                    {/* Total */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex justify-between items-center">
                        <span className="font-semibold text-foreground">TOTAL A COBRAR</span>
                        <span className="text-2xl font-bold text-primary">S/ {totalCalc.total_final.toFixed(2)}</span>
                    </div>

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

                    {/* Comprobante SUNAT */}
                    <div className="border border-border rounded-xl p-4 space-y-3">
                        <p className="text-sm font-semibold text-foreground">¿El cliente requiere comprobante?</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setRequiereComprobante(false)}
                                className={`flex-1 h-10 rounded-lg border text-xs font-semibold transition-[transform,opacity] ${!requiereComprobante ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}
                            >
                                No — Ticket rápido
                            </button>
                            <button
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
                    </div>

                    <div className="flex gap-3">
                        <Button 
                            className="flex-1 h-12 rounded-xl text-sm font-extrabold uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all" 
                            disabled={isPending || (config.modo_automatico && METODOS_CON_REFERENCIA.includes(metodo) && !webhookSuccess) || (METODOS_CON_REFERENCIA.includes(metodo) && !codigoReferencia.trim() && !config.modo_automatico)}
                            onClick={() => registrarPago.mutate()}
                        >
                            {isPending ? 'Procesando...' : config.modo_automatico && METODOS_CON_REFERENCIA.includes(metodo) ? (webhookSuccess ? 'Cobro Exitoso' : 'Esperando Pago...') : 'Confirmar Cobro Manual'}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
});
RegistrarVentaModal.displayName = 'RegistrarVentaModal';
export default RegistrarVentaModal;