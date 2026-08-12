import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStatusColors } from '@/constants/statusColors';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from 'sonner';

/**
 * HabitacionCard — Componente de tarjeta individual para una habitación.
 * Extraído de HabitacionesGrid para reducir el tamaño del componente padre
 * y facilitar pruebas unitarias.
 */
export function HabitacionCard({ h, estadoConfig, AMENITIES_MAP, parseAmenities, openEdit, del }) {
    const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
    const colors = getStatusColors(h.estado);

    return (
        <div
            onClick={() => openEdit(h)}
            className={cn(
                "group cursor-pointer rounded-2xl border p-3.5 sm:p-4 flex flex-col items-center justify-center text-center gap-1 min-h-[125px] transition-all duration-300 relative overflow-hidden",
                colors.card
            )}
        >
            {/* Número de habitación */}
            <p className={cn('text-2xl sm:text-3xl font-bold tabular-nums tracking-tight', colors.number)}>
                {h.numero}
            </p>

            {/* Tipo y piso */}
            <p className="text-[10px] sm:text-xs text-foreground/70 capitalize font-medium">
                {h.tipo}{h.piso ? ` · Piso ${h.piso}` : ''}
            </p>

            {/* Precio */}
            <p className="text-xs font-bold text-foreground mt-0.5 tabular-nums">S/ {h.precio}</p>
            <p className="text-[9px] text-foreground/50">por noche · {parseAmenities(h.descripcion).capacidad || 1} pax</p>

            {/* Notas */}
            {parseAmenities(h.descripcion).notas && (
                <div className="mt-0.5 max-w-[90%] bg-foreground/5 text-foreground text-[9px] px-2 py-0.5 rounded-full truncate font-medium">
                    {parseAmenities(h.descripcion).notas}
                </div>
            )}

            {/* Badge de estado */}
            <StatusBadge status={h.estado} label={cfg.label} className="mt-1 text-[9px]" />

            {/* Amenities */}
            <div className="flex gap-1 text-foreground/50 mt-1">
                {AMENITIES_MAP.map(a => {
                    const Icon = a.icon;
                    return parseAmenities(h.descripcion)[a.id]
                        ? <span key={a.id} title={a.label}><Icon className="w-3 h-3" /></span>
                        : null;
                })}
            </div>

            {/* Acciones (hover) */}
            <div className="absolute inset-x-0 bottom-0 p-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex justify-center">
                <div className="flex gap-1 p-1 bg-background/90 backdrop-blur-xl border border-border/50 rounded-xl shadow-xs w-full">
                    <button
                        aria-label={`Editar habitación ${h.numero}`}
                        onClick={(e) => { e.stopPropagation(); openEdit(h); }}
                        className="flex-1 text-[10px] py-1 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                        <Pencil className="w-3 h-3" /> Editar
                    </button>
                    <button
                        aria-label={`Eliminar habitación ${h.numero}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toast('¿Eliminar habitación?', {
                                action: { label: 'Eliminar', onClick: () => del(h.id) },
                                cancel: { label: 'Cancelar' }
                            });
                        }}
                        className="w-7 h-7 shrink-0 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 flex items-center justify-center transition-colors"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
