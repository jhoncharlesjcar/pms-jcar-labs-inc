import React, { memo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Landmark, CheckCircle2, Printer, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';

/**
 * @param {Object} props
 * @param {boolean} props.closureModal
 * @param {function} props.setClosureModal
 * @param {any} props.stats
 * @param {any} props.user
 * @param {any} props.hotelActual
 * @param {any} props.addCierre
 * @param {function} props.handlePrintHotel
 * @param {function} props.handlePrintPOS
 * @param {function} props.handleExportPDF
 * @param {function} props.handleExportExcel
 * @param {function} props.handlePrintTicket
 */
export const CajaCierreModal = memo(function CajaCierreModal(/** @type {any} */ { 
    closureModal, setClosureModal, 
    stats, user, hotelActual, 
    addCierre, 
    handlePrintHotel, handlePrintPOS, handleExportPDF, handleExportExcel, handlePrintTicket 
}) {
    return (
        <Dialog open={closureModal} onOpenChange={setClosureModal}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-xl border border-border/80 shadow-2xl glass-panel max-h-[90vh] flex flex-col">
                <div className="bg-amber-500/10 p-6 relative overflow-hidden border-b border-amber-500/20 flex-shrink-0">
                    <DialogHeader>
                        <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center mb-3 shadow-sm text-white">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                            Cierre de Turno
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1.5">Confirma el balance actual y cierra la sesión de caja.</p>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-2xl rounded-full -mr-16 -mt-16" />
                </div>

                <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                    {/* Resumen Card Ultra-Compacto */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2.5 relative overflow-hidden group shadow-sm">
                        <div className="absolute top-0 right-0 p-6 bg-primary/10 rounded-full -mr-4 -mt-4 blur-xl group-hover:bg-primary/20 transition-colors" />
                        
                        <div className="flex justify-between items-center relative z-10">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/70">Resumen de Turno</span>
                            <span className="text-[9px] font-bold text-muted-foreground bg-background/50 px-1.5 py-0.5 rounded border border-border/40 shadow-xs">{format(new Date(), "dd/MM/yyyy")}</span>
                        </div>

                        <div className="space-y-1 relative z-10 pt-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-muted-foreground font-bold uppercase tracking-widest">Ventas Hotel:</span>
                                <span className="font-extrabold tabular-nums">S/ {stats.hotel.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-muted-foreground font-bold uppercase tracking-widest">Ventas POS:</span>
                                <span className="font-extrabold tabular-nums">S/ {stats.pos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-primary/10">
                                <span className="text-primary/70 font-black uppercase tracking-widest">Subtotal:</span>
                                <span className="font-extrabold text-primary tabular-nums">S/ {stats.ingresos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-red-500/70 font-black uppercase tracking-widest">Egresos:</span>
                                <span className="font-extrabold text-red-500 tabular-nums">- S/ {stats.egresos.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Desglose SUNAT */}
                        <div className="space-y-1 relative z-10 pt-2.5 border-t border-dotted border-primary/20">
                            <div className="flex justify-between items-center text-[9px]">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-widest">SUNAT Emitidas ({stats.sunatDeclaradasCount}):</span>
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">S/ {stats.sunatDeclaradasTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px]">
                                <span className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest">SUNAT Pendientes ({stats.sunatPendientesCount}):</span>
                                <span className="font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">S/ {stats.sunatPendientesTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[9px]">
                                <span className="text-red-600 dark:text-red-400 font-bold uppercase tracking-widest">SUNAT Rechazadas ({stats.sunatRechazadasCount}):</span>
                                <span className="font-extrabold text-red-600 dark:text-red-400 tabular-nums">S/ {stats.sunatRechazadasTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="pt-2.5 border-t border-dashed border-primary/30 flex justify-between items-center relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Efectivo Caja:</span>
                            <span className="text-xl font-extrabold text-primary tabular-nums tracking-tighter">
                                S/ {stats.balance.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrintHotel} className="flex-col h-auto py-2.5 rounded-lg gap-1 border-border/40 hover:bg-primary/10 shadow-xs active:scale-95 transition-all">
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Ventas Hotel</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handlePrintPOS} className="flex-col h-auto py-2.5 rounded-lg gap-1 border-border/40 hover:bg-primary/10 shadow-xs active:scale-95 transition-all">
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Ventas POS</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-col h-auto py-2.5 rounded-lg gap-1 border-border/40 hover:bg-red-500/10 shadow-xs active:scale-95 transition-all">
                            <FileText className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Reporte PDF</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex-col h-auto py-2.5 rounded-lg gap-1 border-border/40 hover:bg-green-500/10 shadow-xs active:scale-95 transition-all">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-[8px] font-bold uppercase tracking-widest">Reporte Excel</span>
                        </Button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={handlePrintTicket} className="w-full h-9 rounded-md text-[9px] font-bold uppercase tracking-widest text-muted-foreground gap-1.5 hover:bg-muted/50 border border-transparent hover:border-border/40 transition-all">
                        <Printer className="w-3 h-3" /> Imprimir Cierre General Completo
                    </Button>

                    <div className="space-y-2">
                        <Label htmlFor="cierre_notas" className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Notas del Cierre (Opcional)</Label>
                        <textarea 
                            id="cierre_notas"
                            className="w-full p-3 bg-background/50 border border-border/40 rounded-md text-xs font-semibold focus-visible:ring-amber-500/30 focus-visible:border-amber-500/50 min-h-[60px] shadow-inner"
                            placeholder="Indique novedades o diferencias de caja..."
                        />
                    </div>

                    <div className="flex gap-3 pt-3">
                        <Button variant="ghost" onClick={() => setClosureModal(false)} className="flex-1 h-9 rounded-md font-bold text-[10px] uppercase tracking-widest hover:bg-muted">Volver</Button>
                        <Button 
                            className="flex-1 h-9 rounded-md bg-amber-500 hover:bg-amber-600 shadow-md font-extrabold text-xs active:scale-95 transition-all text-white"
                            onClick={() => addCierre.mutate({
                                fecha: new Date().toISOString(),
                                total_ventas: stats.ingresos,
                                total_egresos: stats.egresos,
                                saldo_final: stats.balance,
                                usuario_id: user?.id,
                                usuario_nombre: user?.full_name || user?.email,
                                hotel_id: hotelActual?.id,
                                notas: /** @type {HTMLInputElement} */ (document.getElementById('cierre_notas'))?.value || null
                            })}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Confirmar Cierre
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});
CajaCierreModal.displayName = 'CajaCierreModal';
