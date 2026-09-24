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
        <div>
            {view === 'loading' && (
                <p role="status" className="sr-only">{AVAILABILITY_COPY.loading}</p>
            )}
            <div
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                aria-busy={view === 'loading'}
            >
                {view === 'loading' && Array.from({ length: 6 }, (_, i) => (
                    <div key={i} aria-hidden="true" className="h-24 animate-pulse rounded-xl border border-border/40 bg-muted/60" />
                ))}
                {view === 'rooms' && rooms.map((room) => {
                    const selected = selectedId === room.id;
                    return (
                        <button
                            key={room.id}
                            onClick={() => onSelect(room)}
                            type="button"
                            aria-pressed={selected}
                            className={cn(
                                'flex min-h-11 flex-col justify-between gap-2 rounded-xl border p-3 text-left',
                                selected
                                    ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
                                    : 'border-border bg-card hover:bg-muted/40'
                            )}
                        >
                            <span className="text-lg font-semibold leading-none tabular-nums text-foreground">#{room.numero}</span>
                            <span className="block truncate text-xs text-muted-foreground">{room.tipo}</span>
                            <span className="text-sm font-semibold text-foreground">S/ {room.precio_noche}</span>
                            {selected && <span className="text-xs font-medium text-primary">Seleccionada</span>}
                        </button>
                    );
                })}
                {view === 'empty' && (
                    <p className="col-span-full rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                        {AVAILABILITY_COPY.empty}
                    </p>
                )}
                {view === 'error' && (
                    <p role="alert" className="col-span-full rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3 text-sm text-destructive">
                        {AVAILABILITY_COPY.error}
                    </p>
                )}
            </div>
        </div>
    );
}
