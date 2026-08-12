import React, { memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Landmark, Printer, FileText, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { cierreCajaSchema } from '@/schemas/caja.schema';

const CierreCajaModal = memo(function CierreCajaModal({
    open,
    setOpen,
    stats,
    user,
    hotelActual,
    addCierre,
    handlePrintHotel,
    handlePrintPOS,
    handleExportPDF,
    handleExportExcel,
    handlePrintTicket
}) {
    const form = useForm({
        resolver: zodResolver(cierreCajaSchema),
        defaultValues: {
            notas: ''
        }
    });

    const { register, handleSubmit, formState: { errors } } = form;

    const onSubmit = (data) => {
        addCierre.mutate({
            fecha: new Date().toISOString(),
            total_ventas: stats.ingresos,
            total_egresos: stats.egresos,
            saldo_final: stats.balance,
            usuario_id: user?.id,
            usuario_nombre: user?.full_name || user?.email,
            hotel_id: hotelActual?.id,
            notas: data.notas
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
                <div className="bg-amber-500 p-8 text-foreground relative overflow-hidden">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black font-display flex items-center gap-2">
                            <Landmark className="w-6 h-6" />
                            Cierre de Turno
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-foreground/60 text-xs mt-1">Confirma el balance actual y cierra la sesión de caja.</p>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-foreground/5 blur-3xl rounded-full -mr-20 -mt-20" />
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-8 space-y-6 bg-card">
                    {/* Resumen Card Ultra-Compacto */}
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-1.5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-6 bg-primary/5 rounded-full -mr-3 -mt-3 blur-xl group-hover:bg-primary/10 transition-colors" />
                        
                        <div className="flex justify-between items-center relative z-10">
                            <span className="text-xs font-bold uppercase tracking-[0.1em] text-primary/60">Resumen de Turno</span>
                            <span className="text-xs font-bold text-muted-foreground bg-background/30 px-1.5 py-0.5 rounded border border-border/30">{format(new Date(), "dd/MM/yyyy")}</span>
                        </div>

                        <div className="space-y-0.5 relative z-10">
                            <div className="flex justify-between items-center text-[12px]">
                                <span className="text-muted-foreground italic">Ventas Hotel:</span>
                                <span className="font-bold tabular-nums">S/ {stats.hotel.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                                <span className="text-muted-foreground italic">Ventas Minimarket:</span>
                                <span className="font-bold tabular-nums">S/ {stats.pos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px] pt-0.5 border-t border-primary/5">
                                <span className="text-primary/70 font-medium">Subtotal Global:</span>
                                <span className="font-bold text-primary tabular-nums">S/ {stats.ingresos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[12px]">
                                <span className="text-red-500/70 font-medium">Egresos Efectivo:</span>
                                <span className="font-bold text-red-500 tabular-nums">- S/ {stats.egresos.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Desglose SUNAT */}
                        <div className="space-y-0.5 relative z-10 pt-1.5 border-t border-dotted border-primary/10">
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-emerald-500 font-bold">SUNAT Declaradas ({stats.sunatDeclaradasCount}):</span>
                                <span className="font-bold text-emerald-500 tabular-nums">S/ {stats.sunatDeclaradasTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-amber-500 font-bold">SUNAT Pendientes ({stats.sunatPendientesCount}):</span>
                                <span className="font-bold text-amber-500 tabular-nums">S/ {stats.sunatPendientesTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                                <span className="text-red-500 font-bold">SUNAT Rechazadas ({stats.sunatRechazadasCount}):</span>
                                <span className="font-bold text-red-500 tabular-nums">S/ {stats.sunatRechazadasTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="pt-1 border-t border-dashed border-primary/20 flex justify-between items-center relative z-10">
                            <span className="text-xs font-bold uppercase text-primary/80">Efectivo Físico Caja:</span>
                            <span className="text-xl font-black text-primary tabular-nums">
                                S/ {stats.balanceEfectivo.toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {/* Export Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handlePrintHotel} className="flex-col h-auto py-1.5 gap-1 border-border/50 hover:bg-primary/5">
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-bold">Ventas Hotel</span>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handlePrintPOS} className="flex-col h-auto py-1.5 gap-1 border-border/50 hover:bg-primary/5">
                            <Printer className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-bold">Ventas Minimarket</span>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleExportPDF} className="flex-col h-auto py-1.5 gap-1 border-border/50 hover:bg-red-500/5">
                            <FileText className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-xs font-bold">Reporte PDF</span>
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleExportExcel} className="flex-col h-auto py-1.5 gap-1 border-border/50 hover:bg-green-500/5">
                            <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-xs font-bold">Reporte Excel</span>
                        </Button>
                    </div>

                    <Button type="button" variant="ghost" size="sm" onClick={handlePrintTicket} className="w-full text-xs text-muted-foreground gap-2">
                        <Printer className="w-3 h-3" /> Imprimir Cierre General Completo
                    </Button>

                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Notas del Cierre (Opcional)</Label>
                        <textarea 
                            {...register('notas')}
                            className="w-full p-4 bg-muted/30 border-none rounded-2xl text-base sm:text-sm focus:ring-amber-500/20 min-h-[80px]"
                            placeholder="Indique novedades o diferencias de caja..."
                        />
                        {errors.notas && <p className="text-red-500 text-xs mt-1">{errors.notas.message}</p>}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-12 rounded-2xl">Volver</Button>
                        <Button 
                            type="submit"
                            disabled={addCierre.isPending}
                            className="flex-1 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20"
                        >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            {addCierre.isPending ? 'Procesando...' : 'Confirmar Cierre'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
});
CierreCajaModal.displayName = 'CierreCajaModal';
export default CierreCajaModal;
