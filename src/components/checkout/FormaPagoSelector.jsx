import React, { memo } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';

export const METODOS_UI = [
    { value: 'efectivo', label: 'Efectivo', icon: EfectivoIcon },
    { value: 'yape', label: 'Yape', icon: YapeIcon },
    { value: 'plin', label: 'Plin', icon: PlinIcon },
    { value: 'transferencia', label: 'Transferencia', icon: undefined }, // Placeholder
    { value: 'tarjeta', label: 'Tarjeta', icon: TarjetaIcon },
];

export const FormaPagoSelector = memo(function FormaPagoSelector(/** @type {any} */ {
    metodo,
    setMetodo,
    descuento,
    setDescuento,
    config,
    METODOS_CON_REFERENCIA,
    webhookSuccess,
    qrDinamico,
    generandoQR,
    handleGenerarQR,
    totalCalc,
    hotelActual,
    codigoReferencia,
    setCodigoReferencia
}) {
    return (
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
                    const PaymentIcon = paymentMethod.icon || ShieldCheck;
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

            {/* QR Yape / Plin con Confirmación */}
            {METODOS_CON_REFERENCIA.includes(metodo) && (
                config.modo_automatico ? (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center space-y-4 mt-3">
                        {webhookSuccess ? (
                            <p className="text-emerald-600 font-extrabold text-xl animate-pulse">¡Pago Confirmado Automáticamente! 🎉</p>
                        ) : qrDinamico ? (
                            <>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Escanea para pagar</p>
                                <img src={qrDinamico} alt="QR Dinámico" className="w-40 h-40 mx-auto rounded-lg shadow-md border border-border/50" />
                                <p className="text-xs text-emerald-600 animate-pulse font-bold flex items-center justify-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Esperando confirmación de {config.pasarela_activa}...
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-bold text-muted-foreground">Se generará un QR dinámico de un solo uso válido por 15 minutos.</p>
                                <Button onClick={handleGenerarQR} disabled={generandoQR} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-md h-12">
                                    {generandoQR ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Generar QR de Pago'}
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 space-y-3 mt-3">
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
        </section>
    );
});
