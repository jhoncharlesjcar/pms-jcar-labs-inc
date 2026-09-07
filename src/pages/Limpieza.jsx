import { memo } from 'react';
import { Sparkles, Wrench, CheckCircle2, User, CalendarDays, Filter, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import PageSkeleton from '@/components/loaders/PageSkeleton';
import BroomIcon from '@/components/ui/icons/BroomIcon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusColors } from '@/constants/statusColors';
import { canTransitionRoomStatus, ROOM_STATUS_CONFIG } from '@/constants/roomStatus';
import ConfirmDialog, { useConfirmDialog } from '@/components/common/ConfirmDialog';
import { differenceInMinutes } from 'date-fns';

import { toast } from 'sonner';

import { useLimpiezaData } from './Limpieza/hooks/useLimpiezaData';

const roomStatusConfig = {
    disponible:    { label: ROOM_STATUS_CONFIG.disponible.shortLabel,    icon: CheckCircle2 },
    ocupada:       { label: ROOM_STATUS_CONFIG.ocupada.shortLabel,       icon: User },
    reservada:     { label: ROOM_STATUS_CONFIG.reservada.shortLabel,     icon: CalendarDays },
    mantenimiento: { label: ROOM_STATUS_CONFIG.mantenimiento.shortLabel, icon: Wrench },
    limpieza:      { label: ROOM_STATUS_CONFIG.limpieza.shortLabel,      icon: BroomIcon },
};

const Limpieza = memo(function Limpieza() {
    const { confirmProps, requestConfirm } = useConfirmDialog();
    const {
        verTodas, setVerTodas,
        busqueda, setBusqueda,
        currentTime,
        mantenimientoModal, setMantenimientoModal,
        isLoading,
        actualizarEstado,
        metrics,
        filtradas
    } = useLimpiezaData();

    const handleMarcarListaOptimista = (hab) => {
        const estadoAnterior = hab.estado;
        actualizarEstado.mutate(
            { id: hab.id, estado: 'disponible' },
            {
                onError: () => {
                    toast.error(`Error al actualizar Habitación #${hab.numero}`);
                }
            }
        );
        toast.success(`Habitación #${hab.numero} marcada como LISTA`, {
            duration: 4000,
            action: {
                label: 'Deshacer',
                onClick: () => {
                    actualizarEstado.mutate({ id: hab.id, estado: estadoAnterior });
                    toast.info(`Habitación #${hab.numero} restaurada a ${ROOM_STATUS_CONFIG[estadoAnterior]?.shortLabel || estadoAnterior}`);
                }
            }
        });
    };

    const gridRef = useGsapStaggerList([verTodas, filtradas.length], {
        stagger: 0.04,
        direction: 'y',
        distance: 8,
    });

    return (
        <div className="page-shell w-full pb-20 sm:pb-10">

            {/* Header del Módulo */}
            <div className="page-header sm:items-center">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-xs">
                            <BroomIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Limpieza</h1>
                    </div>
                    <p className="text-muted-foreground text-xs mt-1">Control operacional de amas de llaves y estado de habitaciones</p>
                </div>
            </div>

            {/* Barra de KPIs compacta en Móvil (sin scroll, visible encima del pliegue) */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:hidden">
                <div className="flex items-center gap-2 rounded-xl border border-purple-500/25 bg-purple-500/10 px-3 py-2 shrink-0">
                    <BroomIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 tabular-nums">{metrics.sucias}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Sucias</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 shrink-0">
                    <Wrench className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">{metrics.mantenimiento}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Fallas</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">{metrics.disponibles}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Listas</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 shrink-0">
                    <User className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 tabular-nums">{metrics.ocupadas}</span>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Ocupadas</span>
                </div>
            </div>

            {/* Barra de KPIs completa en Tablet y Desktop */}
            <div className="ui-card-grid hidden sm:grid grid-cols-2 lg:grid-cols-4">
                <div className="enterprise-card metric-card ui-card-pad flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <BroomIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Por Limpiar</p>
                        <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.sucias}</p>
                    </div>
                </div>

                <div className="enterprise-card metric-card ui-card-pad flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Mantenimiento</p>
                        <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.mantenimiento}</p>
                    </div>
                </div>

                <div className="enterprise-card metric-card ui-card-pad flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Listas</p>
                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.disponibles}</p>
                    </div>
                </div>

                <div className="enterprise-card metric-card ui-card-pad flex items-center gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                    <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Ocupadas</p>
                        <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.ocupadas}</p>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
                            <Input
                                type="text"
                                placeholder="Buscar por número o tipo..."
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                className="pl-9 bg-background/50 text-xs"
                            />
                        </div>

                        <Button 
                            variant={verTodas ? "default" : "outline"} 
                            className="w-full gap-2 text-[10px] font-bold uppercase tracking-wider sm:w-auto"
                            onClick={() => setVerTodas(!verTodas)}
                        >
                            <Filter className="w-3.5 h-3.5 text-primary" /> {verTodas ? 'Mostrando Todas las Habitaciones' : 'Solo Pendientes (Sucia / Falla)'}
                        </Button>
                    </div>

                    {isLoading ? (
                        <PageSkeleton variant="limpieza" />
                    ) : (
                        <div 
                            ref={gridRef}
                            className="operational-card-grid"
                        >
                            {filtradas.map(hab => {
                                const conf = roomStatusConfig[hab.estado] || roomStatusConfig.disponible;
                                const colors = getStatusColors(hab.estado);
                                
                                return (
                                    <div
                                        key={hab.id}
                                        className={cn(
                                            "enterprise-card operational-card ui-card-pad flex flex-col justify-between space-y-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg",
                                            colors.card
                                        )}
                                    >
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Habitación</span>
                                                    <p className={cn("text-2xl font-extrabold tabular-nums tracking-tighter leading-none mt-1", colors.number)}>#{hab.numero}</p>
                                                    <p className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase mt-1">{hab.tipo}{hab.piso ? ` · Piso ${hab.piso}` : ''}</p>
                                                </div>
                                                <StatusBadge status={hab.estado} label={conf.label} className="text-[9px] px-2 py-0.5" />
                                            </div>

                                            {/* Motivo de Mantenimiento si aplica */}
                                            {(() => {
                                                try {
                                                    const desc = JSON.parse(hab.descripcion);
                                                    if (hab.estado === 'mantenimiento' && desc.motivo_mantenimiento) {
                                                        return (
                                                            <div className="w-full text-[10px] text-red-600 dark:text-red-400 font-semibold bg-red-500/10 p-1.5 rounded-md border border-red-500/20 leading-tight">
                                                                🚨 Motivo: {desc.motivo_mantenimiento}
                                                            </div>
                                                        );
                                                    }
                                                } catch {}
                                                return null;
                                            })()}

                                            {/* Contador de tiempo transcurrido en limpieza */}
                                            {hab.estado === 'limpieza' && (
                                                <div className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    {(() => {
                                                        try {
                                                            const descObj = JSON.parse(hab.descripcion);
                                                            if (descObj.limpieza_start) {
                                                                const start = new Date(descObj.limpieza_start);
                                                                const diffMins = differenceInMinutes(currentTime, start);
                                                                const hrs = Math.floor(diffMins / 60);
                                                                const mins = diffMins % 60;
                                                                return `En proceso: ${hrs > 0 ? `${hrs}h ` : ''}${mins}m`;
                                                            }
                                                        } catch {}
                                                        return 'En proceso de aseo';
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Botones de Acción Táctil Estandarizados */}
                                        <div className="space-y-2 pt-3 border-t border-border/40">
                                            {canTransitionRoomStatus(hab.estado, 'disponible') && (
                                                <Button 
                                                    aria-label={`Marcar habitación ${hab.numero} como lista`}
                                                    variant="emerald" 
                                                    className="w-full gap-2 text-xs sm:text-sm font-bold shadow-xs min-h-[50px] rounded-xl active:scale-[0.98] transition-transform"
                                                    onClick={() => handleMarcarListaOptimista(hab)}
                                                >
                                                    <CheckCircle2 className="w-4 h-4" /> Marcar Lista
                                                </Button>
                                            )}
                                            
                                            {canTransitionRoomStatus(hab.estado, 'limpieza') && (
                                                <Button 
                                                    aria-label={`Marcar habitación ${hab.numero} como sucia`}
                                                    variant="outline" 
                                                    className="w-full gap-1.5 border-purple-500/30 bg-purple-500/10 text-xs text-purple-600 shadow-xs hover:bg-purple-500/20 dark:text-purple-400 min-h-[44px]"
                                                    onClick={() => {
                                                        requestConfirm({
                                                            title: `Enviar habitación #${hab.numero} a limpieza`,
                                                            description: 'La habitación quedará fuera de venta hasta que Housekeeping confirme que está lista.',
                                                            confirmText: 'Enviar a limpieza',
                                                            onConfirm: () => actualizarEstado.mutate({ id: hab.id, estado: 'limpieza' }),
                                                        });
                                                    }}
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" /> Marcar Sucia
                                                </Button>
                                            )}

                                            {canTransitionRoomStatus(hab.estado, 'mantenimiento') && (
                                                <Button 
                                                    aria-label={`Reportar avería en habitación ${hab.numero}`}
                                                    variant="ghost" 
                                                    className="w-full gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 min-h-[44px]"
                                                    onClick={() => {
                                                        setMantenimientoModal({ open: true, hab: hab, motivo: '' });
                                                    }}
                                                >
                                                    <Wrench className="w-3.5 h-3.5" /> Reportar Falla
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!isLoading && filtradas.length === 0 && (
                        <div className="text-center py-16 bg-card/20 backdrop-blur-xl border border-dashed border-border/40 rounded-2xl flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20 shadow-sm text-emerald-500">
                                <CheckCircle2 className="w-6 h-6" />
                            </div>
                            <p className="text-lg font-extrabold text-foreground tracking-tight">¡Todo al día en Housekeeping!</p>
                            <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mt-1.5 max-w-sm">No hay habitaciones pendientes de limpieza o mantenimiento.</p>
                        </div>
                    )}

            {/* Modal de Mantenimiento */}
            <ConfirmDialog {...confirmProps} isPending={actualizarEstado.isPending} />

            <Dialog open={mantenimientoModal.open} onOpenChange={(val) => setMantenimientoModal(prev => ({ ...prev, open: val }))}>
                <DialogContent className="sm:max-w-md bg-card border-border/40 rounded-[2rem] sm:rounded-xl p-0 shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
                    <div className="p-6 pb-2 border-b border-border/40 flex-shrink-0">
                        <DialogHeader className="mb-2">
                            <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center mb-3 border border-red-500/20 shadow-sm text-red-500">
                                <Wrench className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground">
                                Reportar Falla
                            </DialogTitle>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mt-1">
                                Habitación #{mantenimientoModal.hab?.numero}
                            </p>
                        </DialogHeader>
                    </div>
                    <div className="p-6 py-3 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                        <div className="space-y-2.5">
                            <Label htmlFor="motivo" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Motivo / Problema Reportado</Label>
                            <Input 
                                id="motivo"
                                value={mantenimientoModal.motivo} 
                                onChange={e => setMantenimientoModal(prev => ({ ...prev, motivo: e.target.value }))}
                                placeholder="Ej: Falla en inodoro, fuga de agua..."
                                className="bg-background/50 h-9 rounded-md text-sm border-border/40 font-semibold focus-visible:ring-red-500/30 focus-visible:border-red-500/50"
                                autoFocus
                            />
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-md flex items-start gap-2.5">
                            <Wrench className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <p className="text-[10px] text-red-600 dark:text-red-400 font-bold leading-relaxed">
                                La habitación quedará bloqueada en estado de Mantenimiento hasta que se confirme su reparación y limpieza.
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-2 p-6 pt-3 border-t border-border/40 bg-card/50 flex-shrink-0">
                        <Button 
                            variant="ghost" 
                            onClick={() => setMantenimientoModal({ open: false, hab: null, motivo: '' })}
                            className="rounded-md font-bold h-9 text-xs uppercase tracking-widest hover:bg-muted"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={() => actualizarEstado.mutate({ id: mantenimientoModal.hab?.id, estado: 'mantenimiento', motivo: mantenimientoModal.motivo })}
                            disabled={!mantenimientoModal.motivo.trim() || actualizarEstado.isPending}
                            className="rounded-md font-extrabold h-9 text-xs bg-red-600 hover:bg-red-700 text-white shadow-md transition-all active:scale-95"
                        >
                            {actualizarEstado.isPending ? 'Procesando...' : 'Confirmar Bloqueo'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
});
Limpieza.displayName = 'Limpieza';
export default Limpieza;
