import { cn } from '@/lib/utils';
import { AVAILABILITY_COPY, receptionAvailabilityView } from '@/lib/receptionAvailability';

export function RoomAvailabilityGrid({
    loading,
    error,
    rooms,
    selectedId,
    onSelect,
}) {
    const view = receptionAvailabilityView(Boolean(loading), error, rooms.length);

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {view === 'loading' && (
                <p role="status" className="col-span-full py-4 text-center text-sm text-muted-foreground">
                    {AVAILABILITY_COPY.loading}
                </p>
            )}
            {view === 'rooms' && rooms.map((room) => (
                <button
                    key={room.id}
                    onClick={() => onSelect(room)}
                    type="button"
                    className={cn(
                        'p-3 rounded-xl border text-left transition-all duration-300 relative overflow-hidden group h-20 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md',
                        selectedId === room.id
                            ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/50'
                            : 'border-border/40 bg-card/40 hover:bg-card/60 backdrop-blur-xl shadow-sm'
                    )}
                >
                    <div>
                        <p className="font-bold text-lg leading-none tabular-nums text-foreground">#{room.numero}</p>
                        <p className="text-[9px] text-muted-foreground uppercase font-semibold tracking-widest mt-1 truncate">{room.tipo}</p>
                    </div>
                    <p className="text-xs font-bold text-foreground tracking-tight">S/ {room.precio_noche}</p>
                    {selectedId === room.id && (
                        <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-sm" />
                    )}
                </button>
            ))}
            {view === 'empty' && (
                <p className="col-span-full py-8 text-center text-sm font-medium text-muted-foreground bg-secondary/20 rounded-2xl border border-dashed border-border/60">
                    {AVAILABILITY_COPY.empty}
                </p>
            )}
            {view === 'error' && (
                <p role="alert" className="col-span-full rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                    {AVAILABILITY_COPY.error}
                </p>
            )}
        </div>
    );
}
