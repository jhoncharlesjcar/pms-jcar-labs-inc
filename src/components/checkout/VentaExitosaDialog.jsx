import React, { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, BedDouble, ExternalLink } from 'lucide-react';
import TicketPDF from '@/components/TicketPDF';
import CheckoutProgress from '@/components/checkout/CheckoutProgress';

export const VentaExitosaDialog = memo(function VentaExitosaDialog({ ventaCreada, config, reserva, onClose, onSuccess }) {
    const abrirSunat = () => {
        window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank');
    };

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
});
