import { memo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CircleAlert, Loader2 } from 'lucide-react';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';

// Hook de orquestación
import { useRegistrarVenta } from '@/hooks/useRegistrarVenta';
import { METODOS_CON_REFERENCIA } from '@/services/checkout.service';

// Subcomponentes extraídos
import { ResumenCuenta } from '@/components/checkout/ResumenCuenta';
import { FormaPagoSelector, METODOS_UI } from '@/components/checkout/FormaPagoSelector';
import { FidelidadCard } from '@/components/checkout/FidelidadCard';
import { ComprobanteSelector } from '@/components/checkout/ComprobanteSelector';
import { VentaExitosaDialog } from '@/components/checkout/VentaExitosaDialog';

const RegistrarVentaModal = memo(function RegistrarVentaModal({ reserva, onClose, onSuccess }) {
    const { state, actions } = useRegistrarVenta({ reserva, onClose, onSuccess });
    
    if (state.ventaCreada) {
        return (
            <VentaExitosaDialog 
                ventaCreada={state.ventaCreada} 
                config={state.config} 
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
                        totalConsumos={state.totalConsumos} 
                        totalCalc={state.totalCalc} 
                        igvCalc={state.igvCalc} 
                    />

                    <FormaPagoSelector 
                        metodo={state.metodo} 
                        setMetodo={state.setMetodo} 
                        descuento={state.descuento} 
                        setDescuento={state.setDescuento} 
                        config={state.config} 
                        METODOS_CON_REFERENCIA={METODOS_CON_REFERENCIA} 
                        webhookSuccess={state.webhookSuccess} 
                        qrDinamico={state.qrDinamico} 
                        generandoQR={state.generandoQR} 
                        handleGenerarQR={actions.handleGenerarQR} 
                        totalCalc={state.totalCalc} 
                        hotelActual={state.hotelActual} 
                        codigoReferencia={state.codigoReferencia} 
                        setCodigoReferencia={state.setCodigoReferencia} 
                    />

                    <FidelidadCard 
                        isLoyaltyEnabled={state.isLoyaltyEnabled} 
                        loyaltyAccount={state.loyaltyAccount} 
                        canRedeem={state.canRedeem} 
                        redimirPuntos={state.redimirPuntos} 
                        setRedimirPuntos={state.setRedimirPuntos} 
                        descuentoPuntos={state.descuentoPuntos} 
                        reserva={reserva} 
                    />

                    <ComprobanteSelector 
                        requiereComprobante={state.requiereComprobante} 
                        setRequiereComprobante={state.setRequiereComprobante} 
                        tipoComprobante={state.tipoComprobante} 
                        setTipoComprobante={state.setTipoComprobante} 
                        dniCliente={state.dniCliente} 
                        setDniCliente={state.setDniCliente} 
                        nombreCliente={state.nombreCliente} 
                        setNombreCliente={state.setNombreCliente} 
                        rucCliente={state.rucCliente} 
                        setRucCliente={state.setRucCliente} 
                        razonSocial={state.razonSocial} 
                        setRazonSocial={state.setRazonSocial} 
                        config={state.config} 
                    />
                </div>

                <div className="shrink-0 border-t border-border/70 bg-background/95 p-3 backdrop-blur sm:p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total a cobrar</p>
                            <p className="text-2xl font-bold tabular-nums text-primary">S/ {state.totalCalc.total_final.toFixed(2)}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                            <p className="font-semibold capitalize text-foreground">{METODOS_UI.find(item => item.value === state.metodo)?.label}</p>
                            <p>{state.requiereComprobante ? state.tipoComprobante : 'Ticket interno'}</p>
                        </div>
                    </div>
                    {state.checkoutIssue && (
                        <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 dark:text-amber-400" role="status">
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            {state.checkoutIssue}
                        </p>
                    )}
                    <div className="grid grid-cols-[auto_1fr] gap-2">
                        <Button variant="outline" className="h-11 rounded-lg px-4" disabled={state.isPending} onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            className="h-11 rounded-lg text-sm font-semibold shadow-md shadow-primary/15"
                            disabled={state.isPending || !!state.checkoutIssue}
                            onClick={() => actions.registrarPago.mutate()}
                        >
                            {state.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando…</> : `Confirmar cobro · S/ ${state.totalCalc.total_final.toFixed(2)}`}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
});
RegistrarVentaModal.displayName = 'RegistrarVentaModal';
export default RegistrarVentaModal;
