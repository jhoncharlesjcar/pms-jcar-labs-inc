import React from 'react';
import { CalendarDays, CheckCircle2, FileText, LogIn, MessageSquare, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import ConfirmDialog, { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { cn } from '@/lib/utils';
import { WhatsAppService } from '@/services/whatsapp.service';
import { generarFichaMincetur } from '@/lib/exportMincetur';
import { getReservationOperationalState, OPERATIONAL_STATE_CONFIG } from '@/lib/recepcionCockpit';

const avatarColors = {
    activa: 'from-primary to-primary/70',
    pendiente: 'from-orange-500 to-amber-500',
    finalizada: 'from-green-500 to-emerald-500',
    cancelada: 'from-red-500 to-rose-500',
};

const operationalStateClasses = {
    destructive: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    neutral: 'border-border bg-muted/50 text-muted-foreground',
};

const formatReservationDate = value => value
    ? format(typeof value === 'string' ? parseISO(value) : new Date(value), 'dd/MM')
    : '--';

export const ReservaCard = React.memo((/** @type {any} */ { r, hotelActual, hotelId, user, actualizarEstado, setVentaModal, hotelDb }) => {
    const initials = (r.huesped_nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const { confirmProps, requestConfirm } = useConfirmDialog();
    const operationalState = getReservationOperationalState(r);
    const operationalConfig = OPERATIONAL_STATE_CONFIG[operationalState];
    
    return (
        <article className="enterprise-card operational-card ui-card-pad group transition-all duration-300 ease-out hover:shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-br text-white font-bold text-sm", avatarColors[r.estado] || 'from-gray-500 to-gray-600')}>
                        {initials}
                    </div>
                    <div className="min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-bold text-sm text-foreground tracking-tight leading-none">{r.huesped_nombre}</p>
                            {/* @ts-ignore */}
                            <StatusBadge status={r.estado} className="text-[10px] px-1.5 py-0.5 rounded-sm" />
                            {operationalState !== 'history' && (
                                <span className={cn(
                                    'rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold',
                                    operationalStateClasses[operationalConfig.tone]
                                )}>
                                    {operationalConfig.label}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                            Habitación <span className="text-foreground font-semibold">#{r.habitacion_numero}</span> <span className="opacity-50 mx-1">•</span> {r.noches} {r.noches === 1 ? 'noche' : 'noches'}
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground/80" />
                            {formatReservationDate(r.fecha_entrada)} → {formatReservationDate(r.fecha_salida)} <span className="opacity-50 mx-1">•</span> DNI: <span className="text-foreground">{r.huesped_dni || 'N/A'}</span>
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between lg:justify-end gap-4 mt-1 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-0 border-border/40">
                    <div className="text-left sm:text-right">
                        <p className="text-xl font-bold text-foreground tracking-tight tabular-nums leading-none whitespace-nowrap">S/ {r.total?.toFixed(2)}</p>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-1">Ref: #{r.numero_reserva}</p>
                    </div>
                    <div className="w-px h-8 bg-border/40 hidden sm:block mx-1" />
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-nowrap sm:items-center">
                        {(r.estado === 'pendiente' || r.estado === 'activa') && (
                            <Button size="sm" variant="outline" className="order-2 gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-2.5 text-emerald-600 shadow-xs hover:bg-emerald-500/20 dark:text-emerald-400 sm:order-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    WhatsAppService.enviarMensajeReserva(r, hotelActual, { hotelId, user });
                                }}>
                                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                            </Button>
                        )}
                        {r.estado === 'activa' && (
                            <Button size="sm" variant="outline" className="order-2 gap-1.5 border-blue-500/30 bg-blue-500/10 px-2.5 text-blue-600 shadow-xs hover:bg-blue-500/20 dark:text-blue-400 sm:order-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    generarFichaMincetur(r, {
                                        nombre: hotelActual?.nombre || 'PMS JCAR LABS',
                                        ruc: hotelActual?.ruc || ''
                                    });
                                }}>
                                <FileText className="w-3.5 h-3.5" /> DIRCETUR
                            </Button>
                        )}
                        {r.estado === 'pendiente' && (
                            <Button size="sm" variant="emerald" className="order-first col-span-2 gap-1.5 px-3 shadow-sm sm:order-none sm:col-span-1"
                                onClick={() => {
                                    actualizarEstado.mutate({ id: r.id, estado: 'activa', hab_id: r.habitacion_id, estadoAnterior: r.estado });
                                    setVentaModal(r);
                                }}>
                                <LogIn className="w-3.5 h-3.5" /> Check-in
                            </Button>
                        )}
                        {r.estado === 'activa' && (
                            <Button size="sm" variant="emerald" className="order-first col-span-2 gap-1.5 px-3 shadow-xs sm:order-none sm:col-span-1"
                                onClick={async () => {
                                    const ventasRes = await hotelDb.Venta.filter({ reserva_id: r.id });
                                    const pagado = ventasRes.length > 0;
                                    
                                    if (!pagado) {
                                        requestConfirm({
                                            title: 'La estancia todavía no tiene un pago registrado',
                                            description: 'Antes de finalizar el check-out debes registrar el cobro de la estadía.',
                                            confirmText: 'Registrar pago',
                                            onConfirm: () => setVentaModal(r),
                                        });
                                        return;
                                    }

                                    requestConfirm({
                                        title: '¿Finalizar la estancia?',
                                        description: `La habitación #${r.habitacion_numero} pasará a pendiente de limpieza.`,
                                        confirmText: 'Finalizar y enviar a limpieza',
                                        onConfirm: () => actualizarEstado.mutate({ id: r.id, estado: 'finalizada', hab_id: r.habitacion_id, estadoAnterior: r.estado }),
                                    });
                                }}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> Check-out
                            </Button>
                        )}
                        {(r.estado === 'pendiente' || r.estado === 'activa') && (
                            <Button size="iconSm" variant="ghost" aria-label={r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'} title={r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'} className="order-3 col-span-2 w-full px-2 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 sm:order-none sm:col-span-1 sm:w-9 sm:p-0"
                                onClick={() => {
                                    const msg = r.estado === 'activa'
                                        ? '¿Anular esta estadía activa? La habitación pasará a limpieza y no se emitirá ningún comprobante.'
                                        : '¿Cancelar esta reserva pendiente?';
                                    requestConfirm({
                                        title: r.estado === 'activa' ? '¿Anular la estancia activa?' : '¿Cancelar la reserva?',
                                        description: msg,
                                        variant: 'destructive',
                                        confirmText: r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva',
                                        onConfirm: () => actualizarEstado.mutate({ id: r.id, estado: 'cancelada', hab_id: r.habitacion_id, estadoAnterior: r.estado }),
                                    });
                                }}>
                                <XCircle className="w-4 h-4" />
                                <span className="sm:sr-only">{r.estado === 'activa' ? 'Anular estancia' : 'Cancelar reserva'}</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {/* @ts-ignore */}
            <ConfirmDialog {...confirmProps} isPending={actualizarEstado.isPending} />
        </article>
    );
});
ReservaCard.displayName = 'ReservaCard';
