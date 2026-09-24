import React, { memo, useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    AlertCircle, CheckCircle2, DollarSign, FileSpreadsheet, FileText,
    Landmark, Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { evaluarArqueoEfectivo } from '@/services/caja.service';

const money = (value) => `S/ ${Number(value || 0).toFixed(2)}`;

/** @param {{closureModal: boolean, setClosureModal: Function, stats: any, user: any, hotelActual: any, addCierre: any, handlePrintHotel: Function, handlePrintPOS: Function, handleExportPDF: Function, handleExportExcel: Function, handlePrintTicket: Function}} props */
export const CajaCierreModal = memo(function CajaCierreModal(/** @type {any} */ {
    closureModal, setClosureModal, stats, user, hotelActual, addCierre,
    handlePrintHotel, handlePrintPOS, handleExportPDF, handleExportExcel, handlePrintTicket,
}) {
    const [efectivoContado, setEfectivoContado] = useState('');
    const [notas, setNotas] = useState('');

    useEffect(() => {
        if (closureModal) {
            setEfectivoContado('');
            setNotas('');
        }
    }, [closureModal]);

    const esperado = Number(stats?.balanceEfectivo || 0);
    const contado = efectivoContado === '' ? null : Number(efectivoContado);
    const arqueo = useMemo(() => evaluarArqueoEfectivo(esperado, contado), [esperado, contado]);
    const notaIncompleta = arqueo.requiereNota && notas.trim().length < 3;
    const canConfirm = arqueo.estado !== 'sin_conteo' && !notaIncompleta && !addCierre.isPending;

    const auditConfig = {
        sin_conteo: { label: 'Conteo pendiente', message: 'Ingresa el efectivo físico para comparar.', className: 'border-border bg-muted/40 text-muted-foreground' },
        cuadrado: { label: 'Caja cuadrada', message: 'El efectivo contado coincide con el sistema.', className: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
        faltante: { label: 'Faltante de efectivo', message: 'Documenta la diferencia antes de cerrar.', className: 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400' },
        sobrante: { label: 'Sobrante de efectivo', message: 'Documenta la diferencia antes de cerrar.', className: 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
    }[arqueo.estado];

    const handleConfirm = () => {
        if (!canConfirm) return;

        const auditNote = `Arqueo: esperado ${money(esperado)}, contado ${money(contado)}, diferencia ${money(arqueo.diferencia)} (${arqueo.estado}).`;
        const notasFinales = [auditNote, notas.trim()].filter(Boolean).join(' ');

        addCierre.mutate({
            fecha: new Date().toISOString(),
            total_ventas: Number(stats.ingresos || 0),
            total_egresos: Number(stats.egresos || 0),
            saldo_final: Number(stats.balance || 0),
            usuario_id: user?.id,
            usuario_nombre: user?.full_name || user?.email,
            hotel_id: hotelActual?.id,
            notas: notasFinales,
        }, {
            onSuccess: () => {
                toast.success('Cierre registrado con su arqueo de efectivo.');
                setClosureModal(false);
            },
            onError: () => toast.error('No se pudo registrar el cierre. Intenta nuevamente.'),
        });
    };

    return (
        <Dialog open={closureModal} onOpenChange={setClosureModal}>
            <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden border border-border/80 bg-card p-0 shadow-2xl max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none sm:rounded-2xl">
                <div className="shrink-0 border-b border-border/60 bg-amber-500/10 p-4 pr-12 sm:p-5 sm:pr-12">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                                <Landmark className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div>
                                <DialogTitle className="text-left text-xl font-bold tracking-tight">Auditar y cerrar turno</DialogTitle>
                                <p className="mt-1 text-left text-xs text-muted-foreground">{format(new Date(), "dd/MM/yyyy · HH:mm")} · Confirma el dinero antes de registrar el cierre.</p>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                        <div className="space-y-4">
                            <section className="rounded-xl border border-border/60 bg-muted/15 p-4" aria-labelledby="resumen-turno">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h2 id="resumen-turno" className="text-sm font-semibold text-foreground">Resumen registrado</h2>
                                        <p className="text-xs text-muted-foreground">Ventas y egresos consolidados por el sistema</p>
                                    </div>
                                    <span className="text-xs font-bold tabular-nums text-primary">{money(stats.balance)}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        ['Ventas hotel', stats.hotel], ['Ventas POS', stats.pos],
                                        ['Ingresos', stats.ingresos], ['Egresos', -Number(stats.egresos || 0)],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-lg border border-border/40 bg-background/60 p-3">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                                            <p className="mt-1 text-sm font-bold tabular-nums text-foreground">{money(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/60 p-4" aria-labelledby="medios-turno">
                                <div className="mb-3 flex items-center gap-2">
                                    <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
                                    <h2 id="medios-turno" className="text-sm font-semibold text-foreground">Medios de pago</h2>
                                </div>
                                <div className="space-y-2">
                                    {Object.entries({
                                        Efectivo: stats.metodos?.efectivo,
                                        Yape: stats.metodos?.yape,
                                        Plin: stats.metodos?.plin,
                                        Transferencia: stats.metodos?.transferencia,
                                        Tarjeta: stats.metodos?.tarjeta,
                                    }).map(([label, value]) => (
                                        <div key={label} className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-semibold tabular-nums text-foreground">{money(value)}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 flex items-center justify-between border-t border-dashed border-border pt-3">
                                    <span className="text-xs font-semibold text-foreground">Efectivo esperado</span>
                                    <span className="text-lg font-bold tabular-nums text-sky-600">{money(esperado)}</span>
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/60 p-4" aria-label="Control SUNAT">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div><p className="text-lg font-bold text-emerald-600">{Number(stats.sunatDeclaradasCount || 0)}</p><p className="text-xs text-muted-foreground">Aceptados</p></div>
                                    <div><p className="text-lg font-bold text-amber-600">{Number(stats.sunatPendientesCount || 0)}</p><p className="text-xs text-muted-foreground">Pendientes</p></div>
                                    <div><p className="text-lg font-bold text-rose-600">{Number(stats.sunatRechazadasCount || 0)}</p><p className="text-xs text-muted-foreground">Rechazados</p></div>
                                </div>
                            </section>
                        </div>

                        <div className="space-y-4 lg:sticky lg:top-0">
                            <section className="rounded-xl border border-primary/20 bg-primary/5 p-4" aria-labelledby="arqueo-fisico">
                                <div className="mb-4 flex items-center gap-2">
                                    <Landmark className="h-4 w-4 text-primary" aria-hidden="true" />
                                    <div>
                                        <h2 id="arqueo-fisico" className="text-sm font-semibold text-foreground">Arqueo de efectivo</h2>
                                        <p className="text-xs text-muted-foreground">Cuenta únicamente el dinero físico del cajón.</p>
                                    </div>
                                </div>
                                <Label htmlFor="efectivo-contado" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Efectivo contado</Label>
                                <div className="relative mt-1">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">S/</span>
                                    <Input
                                        id="efectivo-contado"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        inputMode="decimal"
                                        value={efectivoContado}
                                        onChange={(event) => setEfectivoContado(event.target.value)}
                                        placeholder="0.00"
                                        className="h-12 pl-10 text-lg font-bold tabular-nums"
                                    />
                                </div>

                                <div className={cn('mt-3 rounded-lg border p-3', auditConfig.className)} role="status">
                                    <div className="flex items-start gap-2">
                                        {arqueo.estado === 'cuadrado' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-semibold">{auditConfig.label}</p>
                                                {arqueo.estado !== 'sin_conteo' && <p className="text-sm font-bold tabular-nums">{money(arqueo.diferencia)}</p>}
                                            </div>
                                            <p className="mt-0.5 text-xs opacity-80">{auditConfig.message}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <Label htmlFor="cierre-notas" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Notas {arqueo.requiereNota ? '(obligatorias por diferencia)' : '(opcionales)'}
                                    </Label>
                                    <textarea
                                        id="cierre-notas"
                                        value={notas}
                                        onChange={(event) => setNotas(event.target.value)}
                                        className="mt-1 min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        placeholder="Novedades del turno o explicación de la diferencia…"
                                        aria-invalid={notaIncompleta}
                                    />
                                    {notaIncompleta && <p className="mt-1 text-xs font-medium text-rose-600">Explica la diferencia con al menos 3 caracteres.</p>}
                                </div>
                            </section>

                            <section className="rounded-xl border border-border/60 p-4" aria-label="Exportar cierre">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Respaldos antes del cierre</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" onClick={handlePrintHotel} className="h-10 gap-2 text-xs"><Printer className="h-3.5 w-3.5" /> Hotel</Button>
                                    <Button variant="outline" onClick={handlePrintPOS} className="h-10 gap-2 text-xs"><Printer className="h-3.5 w-3.5" /> POS</Button>
                                    <Button variant="outline" onClick={handleExportPDF} className="h-10 gap-2 text-xs"><FileText className="h-3.5 w-3.5" /> PDF</Button>
                                    <Button variant="outline" onClick={handleExportExcel} className="h-10 gap-2 text-xs"><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</Button>
                                </div>
                                <Button variant="ghost" onClick={handlePrintTicket} className="mt-2 h-10 w-full gap-2 text-xs">
                                    <Printer className="h-3.5 w-3.5" /> Imprimir resumen general
                                </Button>
                            </section>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-border/60 bg-background/95 p-3 backdrop-blur sm:p-4">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" onClick={() => setClosureModal(false)} className="h-11 sm:min-w-28">Volver</Button>
                        <Button onClick={handleConfirm} disabled={!canConfirm} className="h-11 gap-2 bg-amber-500 font-semibold text-white hover:bg-amber-600 sm:min-w-52">
                            {addCierre.isPending ? 'Registrando…' : <><DollarSign className="h-4 w-4" /> Confirmar cierre</>}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});

CajaCierreModal.displayName = 'CajaCierreModal';
