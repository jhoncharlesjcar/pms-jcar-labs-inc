import { memo } from 'react';
import { Plus, BedDouble, Wrench, CheckCircle2, CalendarDays, User, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/useHotelData';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { filtrarPorEstado } from '@/services/habitaciones.service';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageSkeleton from '@/components/loaders/PageSkeleton';
import EmptyState from '@/components/common/EmptyState';

import { useHabitacionesData } from './Habitaciones/hooks/useHabitacionesData';
import { HabitacionCard } from './Habitaciones/components/HabitacionCard';
import { HabitacionFormModal } from './Habitaciones/components/HabitacionFormModal';

export const estadoConfig = {
    disponible: { 
        label: 'Disponible', 
        icon: CheckCircle2, 
        color: 'text-[hsl(var(--state-disponible-fg))]', 
        bg: 'bg-[hsl(var(--state-disponible-bg))] border-[hsl(var(--state-disponible-border))]' 
    },
    ocupada: { 
        label: 'Ocupada', 
        icon: User, 
        color: 'text-[hsl(var(--state-ocupada-fg))]', 
        bg: 'bg-[hsl(var(--state-ocupada-bg))] border-[hsl(var(--state-ocupada-border))]' 
    },
    reservada: { 
        label: 'Reservada', 
        icon: CalendarDays, 
        color: 'text-[hsl(var(--state-reservada-fg))]', 
        bg: 'bg-[hsl(var(--state-reservada-bg))] border-[hsl(var(--state-reservada-border))]' 
    },
    mantenimiento: { 
        label: 'Mantenimiento', 
        icon: Wrench, 
        color: 'text-[hsl(var(--state-mantenimiento-fg))]', 
        bg: 'bg-[hsl(var(--state-mantenimiento-bg))] border-[hsl(var(--state-mantenimiento-border))]' 
    },
    limpieza: { 
        label: 'Limpieza', 
        icon: Sparkles, 
        color: 'text-[hsl(var(--state-limpieza-fg))]', 
        bg: 'bg-[hsl(var(--state-limpieza-bg))] border-[hsl(var(--state-limpieza-border))]' 
    },
};

const Habitaciones = memo(function Habitaciones() {
    const { db: hotelDb, hotelId } = useHotelData();
    const {
        habitaciones,
        isLoading,
        open, setOpen,
        form, setForm,
        amenities, setAmenities,
        editId,
        filtroEstado, setFiltroEstado,
        deleteTarget, setDeleteTarget,
        openEdit, openNew,
        handleSave, requestDelete,
        del, save
    } = useHabitacionesData(hotelDb, hotelId);

    // Stagger 2D wave para el grid de habitaciones (4 columnas en desktop)
    const gridRef = useGsapStaggerList([filtroEstado, habitaciones.length], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
        grid: 'auto',
        from: 'start',
    });

    const filtradas = (filtroEstado === 'todos' ? habitaciones : filtrarPorEstado(habitaciones, filtroEstado))
        .sort((a, b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.numero).localeCompare(String(b.numero));
        });

    const agrupadasPorPiso = filtradas.reduce((acc, hab) => {
        const piso = hab.piso?.trim() || 'Sin Piso';
        if (!acc[piso]) acc[piso] = [];
        acc[piso].push(hab);
        return acc;
    }, {});

    const pisosOrdenados = Object.keys(agrupadasPorPiso).sort((a, b) => {
        if (a === 'Sin Piso') return 1;
        if (b === 'Sin Piso') return -1;
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    return (
        <div className="page-shell">

            <div className="page-header sm:items-center">
                <div className="flex items-center gap-3.5">
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary shadow-sm sm:flex">
                        <BedDouble className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary/75">Inventario operativo</p>
                        <h1 className="text-3xl font-extrabold tracking-[-0.045em] text-foreground sm:text-[2.15rem]">Habitaciones</h1>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{habitaciones.length} unidades registradas · disponibilidad en tiempo real</p>
                    </div>
                </div>
                <div className="w-full sm:w-auto">
                    <Button onClick={openNew} className="w-full gap-2 px-5 sm:w-auto">
                        <Plus className="w-4 h-4" /> Nueva Habitación
                    </Button>
                </div>
            </div>
            <div>
                <div className="room-filter-bar no-scrollbar sticky top-0 z-10 w-full max-w-full lg:relative">
                    <div className="no-scrollbar flex w-full gap-1 overflow-x-auto">
                        <button
                            onClick={() => setFiltroEstado('todos')}
                            className={cn(
                                "flex min-h-11 min-w-[128px] flex-none items-center justify-center gap-2 rounded-xl px-3.5 text-[11px] font-bold transition-all duration-200 active:scale-95 whitespace-nowrap lg:flex-1",
                                filtroEstado === 'todos' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/75 hover:text-foreground"
                            )}
                        >
                            <BedDouble className="h-4 w-4 opacity-80" />
                            <span>Todas</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[9px] tabular-nums", filtroEstado === 'todos' ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{habitaciones.length}</span>
                        </button>
                        {Object.entries(estadoConfig).map(([key, cfg]) => {
                            const count = habitaciones.filter(h => h.estado === key).length;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setFiltroEstado(key)}
                                    className={cn(
                                        "flex min-h-11 min-w-[128px] flex-none items-center justify-center gap-2 rounded-xl px-3.5 text-[11px] font-bold transition-all duration-200 active:scale-95 whitespace-nowrap lg:flex-1",
                                        filtroEstado === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/75 hover:text-foreground"
                                    )}
                                >
                                    <cfg.icon className={cn("h-4 w-4", filtroEstado === key ? "opacity-80" : cfg.color)} />
                                    <span>{cfg.label}</span>
                                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] tabular-nums", filtroEstado === key ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Floor Plan View */}
            {isLoading ? (
                <PageSkeleton variant="limpieza" />
            ) : filtradas.length === 0 ? (
                <EmptyState
                    icon={BedDouble}
                    title="No hay habitaciones"
                    description={filtroEstado !== 'todos' ? `No hay habitaciones en estado "${estadoConfig[filtroEstado]?.label || filtroEstado}"` : 'Registra una nueva habitación para comenzar.'}
                    action={filtroEstado !== 'todos' ? null : { label: 'Nueva Habitación', icon: Plus, onClick: openNew }}
                />
            ) : (
                <div ref={gridRef} className="space-y-8">
                    {pisosOrdenados.map((piso) => (
                        <section key={piso} className="space-y-3.5">
                            {/* Floor Header */}
                            <div className="flex items-center gap-3">
                                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-secondary/25 bg-secondary/10 px-2 text-[11px] font-extrabold text-foreground tabular-nums">
                                    {piso === 'Sin Piso' ? '—' : String(piso).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                    <h2 className="whitespace-nowrap text-sm font-extrabold tracking-tight text-foreground">
                                        {piso === 'Sin Piso' ? 'Sin asignar' : `Piso ${piso}`}
                                    </h2>
                                    <p className="text-[10px] font-semibold text-muted-foreground">{agrupadasPorPiso[piso].length} habitaciones</p>
                                </div>
                                <div className="h-px flex-1 bg-border/70" />
                            </div>

                            {/* Floor Grid */}
                            <div className="room-card-grid">
                                {agrupadasPorPiso[piso].map(h => (
                                    <HabitacionCard 
                                        key={h.id} 
                                        h={h} 
                                        estadoConfig={estadoConfig} 
                                        openEdit={openEdit} 
                                        requestDelete={requestDelete} 
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}

            {/* Modal de confirmación para eliminar habitación */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent className="rounded-2xl border-red-500/20 max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-foreground">¿Eliminar habitación #{deleteTarget?.numero}?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-sm">
                            Esta acción eliminará permanentemente la habitación del sistema. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="rounded-xl font-semibold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => deleteTarget && del.mutate(deleteTarget.id)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold gap-2 shadow-lg shadow-red-600/20"
                        >
                            <Trash2 className="w-4 h-4" /> Eliminar Habitación
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Slide-over (Sheet) para Editar/Crear */}
            <HabitacionFormModal 
                open={open} setOpen={setOpen}
                form={form} setForm={setForm}
                amenities={amenities} setAmenities={setAmenities}
                editId={editId}
                estadoConfig={estadoConfig}
                handleSave={handleSave}
                isPending={save.isPending}
            />
        </div>
    );
});
Habitaciones.displayName = 'Habitaciones';
export default Habitaciones;
