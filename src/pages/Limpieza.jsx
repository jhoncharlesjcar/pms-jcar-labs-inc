// @ts-nocheck
import { useState, useEffect, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Wrench, CheckCircle2, User, CalendarDays, Filter, Search, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useHotelData } from '@/hooks/use-hotel-data';
import { cn } from '@/lib/utils';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { toast } from 'sonner';
import PageSkeleton from '@/components/loaders/PageSkeleton';
import { formatErrorMessage } from '@/utils/errorMapping';
import BroomIcon from '@/components/ui/icons/BroomIcon';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusColors } from '@/constants/statusColors';
import { differenceInMinutes } from 'date-fns';
const roomStatusConfig = {
    disponible:    { label: 'Limpia',            icon: CheckCircle2 },
    ocupada:       { label: 'Ocupada',           icon: User },
    reservada:     { label: 'Reservada',         icon: CalendarDays },
    mantenimiento: { label: 'Mantenimiento',     icon: Wrench },
    limpieza:      { label: 'Sucia / Limpieza',  icon: BroomIcon },
};

const Limpieza = memo(function Limpieza() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [verTodas, setVerTodas] = useState(false);
    const [busqueda, setBusqueda] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [mantenimientoModal, setMantenimientoModal] = useState({ open: false, hab: null, motivo: '' });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const { data: habitaciones = [], isLoading } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const actualizarEstado = useMutation({
        mutationFn: (/** @type {{id: string, estado: string, motivo?: string}} */ { id, estado, motivo }) => {
            const currentRoom = habitaciones.find(h => h.id === id);
            let descripcionObj = {};
            try {
                if (currentRoom?.descripcion) {
                    descripcionObj = JSON.parse(currentRoom.descripcion);
                }
            } catch {}

            if (estado === 'limpieza') {
                descripcionObj.limpieza_start = new Date().toISOString();
            } else if (estado === 'disponible') {
                delete descripcionObj.limpieza_start;
                delete descripcionObj.motivo_mantenimiento;
            } else if (estado === 'mantenimiento' && motivo) {
                descripcionObj.motivo_mantenimiento = motivo;
            }

            return hotelDb.Habitacion.update(id, { 
                estado, 
                descripcion: JSON.stringify(descripcionObj) 
            });
        },
        onMutate: async (/** @type {{id: string, estado: string, motivo?: string}} */ { id, estado, motivo }) => {
            await qc.cancelQueries({ queryKey: ['habitaciones', hotelId] });
            const previousHabitaciones = qc.getQueryData(['habitaciones', hotelId]);

            qc.setQueryData(['habitaciones', hotelId], (old) => {
                if (!old) return [];
                return old.map(hab => {
                    if (hab.id === id) {
                        let descripcionObj = {};
                        try {
                            if (hab.descripcion) {
                                descripcionObj = JSON.parse(hab.descripcion);
                            }
                        } catch {}

                        if (estado === 'limpieza') {
                            descripcionObj.limpieza_start = new Date().toISOString();
                        } else if (estado === 'disponible') {
                            delete descripcionObj.limpieza_start;
                            delete descripcionObj.motivo_mantenimiento;
                        } else if (estado === 'mantenimiento' && motivo) {
                            descripcionObj.motivo_mantenimiento = motivo;
                        }
                        return {
                            ...hab,
                            estado,
                            descripcion: JSON.stringify(descripcionObj)
                        };
                    }
                    return hab;
                });
            });

            return { previousHabitaciones };
        },
        onError: (err, newVariables, context) => {
            if (context?.previousHabitaciones) {
                qc.setQueryData(['habitaciones', hotelId], context.previousHabitaciones);
            }
            toast.error(formatErrorMessage(err, 'Error al actualizar el estado de la habitación'));
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            setMantenimientoModal({ open: false, hab: null, motivo: '' });
        },
        onSuccess: () => {
            toast.success('Estado actualizado');
        },
    });

    // Métrica de Housekeeping
    const metrics = useMemo(() => {
        const sucias = habitaciones.filter(h => h.estado === 'limpieza').length;
        const mantenimiento = habitaciones.filter(h => h.estado === 'mantenimiento').length;
        const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
        const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
        return { sucias, mantenimiento, disponibles, ocupadas };
    }, [habitaciones]);

    const filtradas = useMemo(() => {
        return habitaciones
            .filter(h => {
                const coincideBusqueda = !busqueda || 
                    String(h.numero).toLowerCase().includes(busqueda.toLowerCase()) || 
                    (h.tipo || '').toLowerCase().includes(busqueda.toLowerCase());
                
                const coincideFiltro = verTodas || h.estado === 'limpieza' || h.estado === 'mantenimiento';
                return coincideBusqueda && coincideFiltro;
            })
            .sort((a, b) => {
                const numA = parseInt(a.numero, 10);
                const numB = parseInt(b.numero, 10);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return String(a.numero).localeCompare(String(b.numero));
            });
    }, [habitaciones, verTodas, busqueda]);

    const gridRef = useGsapStaggerList([verTodas, filtradas.length], {
        stagger: 0.05,
        direction: 'y',
        distance: 10,
    });

    return (
        <div className="w-full space-y-6 pb-20 sm:pb-10">

            {/* Header del Módulo */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

            {/* Barra de KPIs de Housekeeping */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3.5 bg-card/40 hover:bg-card/60 transition-all duration-300 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <BroomIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Por Limpiar</p>
                        <p className="text-2xl font-extrabold text-purple-600 dark:text-purple-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.sucias}</p>
                    </div>
                </div>

                <div className="p-3.5 bg-card/40 hover:bg-card/60 transition-all duration-300 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Mantenimiento</p>
                        <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.mantenimiento}</p>
                    </div>
                </div>

                <div className="p-3.5 bg-card/40 hover:bg-card/60 transition-all duration-300 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Listas</p>
                        <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.disponibles}</p>
                    </div>
                </div>

                <div className="p-3.5 bg-card/40 hover:bg-card/60 transition-all duration-300 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-lg hover:-translate-y-1">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <User className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Ocupadas</p>
                        <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums tracking-tighter leading-none mt-1">{metrics.ocupadas}</p>
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
                                className="pl-9 h-9 rounded-md bg-background/50 border-border/50 text-xs"
                            />
                        </div>

                        <Button 
                            variant={verTodas ? "default" : "outline"} 
                            className="w-full sm:w-auto gap-2 rounded-md h-9 shadow-sm font-bold text-[10px] uppercase tracking-wider"
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
                            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
                        >
                            {filtradas.map(hab => {
                                const conf = roomStatusConfig[hab.estado] || roomStatusConfig.disponible;
                                const colors = getStatusColors(hab.estado);
                                
                                return (
                                    <div
                                        key={hab.id}
                                        className={cn(
                                            "p-4 rounded-xl border border-border/40 dark:border-white/10 shadow-sm flex flex-col justify-between transition-all duration-300 bg-card/40 hover:bg-card/60 hover:-translate-y-1 hover:shadow-lg backdrop-blur-xl space-y-3",
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
                                            {hab.estado !== 'disponible' && (
                                                <Button 
                                                    aria-label={`Marcar habitación ${hab.numero} como lista`}
                                                    variant="emerald" 
                                                    className="w-full h-9 rounded-md gap-1.5 text-xs font-bold shadow-xs transition-all active:scale-95"
                                                    onClick={() => {
                                                        toast(`¿Marcar habitación #${hab.numero} como LIMPIA y DISPONIBLE?`, {
                                                            action: {
                                                                label: 'Confirmar',
                                                                onClick: () => actualizarEstado.mutate({ id: hab.id, estado: 'disponible' })
                                                            },
                                                            cancel: { label: 'Cancelar' }
                                                        });
                                                    }}
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Lista
                                                </Button>
                                            )}
                                            
                                            {hab.estado !== 'limpieza' && (
                                                <Button 
                                                    aria-label={`Marcar habitación ${hab.numero} como sucia`}
                                                    variant="outline" 
                                                    className="w-full h-9 rounded-md gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 shadow-xs transition-all active:scale-95"
                                                    onClick={() => {
                                                        toast(`¿Marcar habitación #${hab.numero} como SUCIA?`, {
                                                            action: {
                                                                label: 'Confirmar',
                                                                onClick: () => actualizarEstado.mutate({ id: hab.id, estado: 'limpieza' })
                                                            },
                                                            cancel: { label: 'Cancelar' }
                                                        });
                                                    }}
                                                >
                                                    <Sparkles className="w-3.5 h-3.5" /> Marcar Sucia
                                                </Button>
                                            )}

                                            {hab.estado !== 'mantenimiento' && (
                                                <Button 
                                                    aria-label={`Reportar avería en habitación ${hab.numero}`}
                                                    variant="ghost" 
                                                    className="w-full h-8 rounded-md gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
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
            <Dialog open={mantenimientoModal.open} onOpenChange={(val) => setMantenimientoModal(prev => ({ ...prev, open: val }))}>
                <DialogContent className="sm:max-w-md bg-card border-border/40 rounded-xl p-6 shadow-2xl">
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
                    <div className="space-y-4 py-3">
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
                    <DialogFooter className="gap-2 sm:gap-2 pt-2">
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
