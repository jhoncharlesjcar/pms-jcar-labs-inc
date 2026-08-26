import { Pencil, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { AMENITIES_MAP, parseAmenities } from '../utils/amenities';

export function HabitacionCard({ h, estadoConfig, openEdit, requestDelete }) {
    const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
    const stateIconWrapperColors = {
        disponible: 'bg-green-500/10 text-green-600 dark:text-green-400',
        ocupada: 'bg-red-500/10 text-red-600 dark:text-red-400',
        reservada: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        mantenimiento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        limpieza: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    };
    const StateIcon = cfg.icon;
    const roomAmenities = AMENITIES_MAP.filter(a => parseAmenities(h.descripcion)[a.id]);

    return (
        <article
            data-state={h.estado}
            className="room-card group flex flex-col justify-between tap-active"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                    <div className={cn(
                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-current/10",
                        stateIconWrapperColors[h.estado] || stateIconWrapperColors.disponible
                    )}>
                        <StateIcon className="h-4 w-4" />
                    </div>
                    <StatusBadge status={h.estado} label={cfg.label} showIcon={false} className="rounded-full px-2 py-1 text-[9px] font-extrabold tracking-[0.08em]" />
                </div>
                <div className="flex items-center gap-1">
                    <button aria-label={`Editar habitación ${h.numero}`} title="Editar habitación" onClick={() => openEdit(h)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                        <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                        aria-label={`Eliminar habitación ${h.numero}`}
                        title="Eliminar habitación"
                        onClick={() => requestDelete(h)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            <div className="my-4 flex items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Habitación</p>
                    <p className="room-card-number font-extrabold text-foreground">{h.numero}</p>
                    <p className="mt-1.5 truncate text-[11px] font-semibold capitalize text-muted-foreground">{h.tipo}{h.piso ? ` · Piso ${h.piso}` : ''}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Tarifa noche</p>
                    <p className="mt-1 text-lg font-extrabold tracking-[-0.04em] text-foreground tabular-nums"><span className="mr-1 text-[11px] font-bold text-muted-foreground">S/</span>{h.precio_noche ?? h.precio ?? 0}</p>
                </div>
            </div>

            <div className="flex min-h-8 items-center justify-between gap-3 border-t border-border/60 pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                    {roomAmenities.length > 0 ? roomAmenities.map(a => {
                        const Icon = a.icon;
                        return (
                            <span key={a.id} title={a.label} className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                                <Icon className="h-3.5 w-3.5" />
                            </span>
                        );
                    }) : <span className="truncate text-[10px] font-semibold">Equipamiento estándar</span>}
                </div>
                <span className="flex-shrink-0 rounded-lg bg-muted/65 px-2 py-1 text-[9px] font-extrabold text-muted-foreground">{h.capacidad || 1} huésped{Number(h.capacidad || 1) === 1 ? '' : 'es'}</span>
            </div>
        </article>
    );
}
