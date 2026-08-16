import { AlertCircle, BedDouble, DoorOpen, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

const FILTERS = [
    { value: 'atencion', label: 'Atención', countKey: 'attention' },
    { value: 'activa', label: 'En estancia', countKey: 'active' },
    { value: 'pendiente', label: 'Pendientes', countKey: 'pending' },
    { value: 'historial', label: 'Historial', countKey: 'history' },
    { value: 'todas', label: 'Todas', countKey: 'total' },
];

const METRICS = [
    {
        key: 'attention',
        label: 'Atención ahora',
        description: 'Llegadas y salidas de hoy o vencidas',
        icon: AlertCircle,
        filter: 'atencion',
        tone: 'rose',
    },
    {
        key: 'pending',
        label: 'Por recibir',
        description: 'Reservas pendientes de check-in',
        icon: LogIn,
        filter: 'pendiente',
        tone: 'amber',
    },
    {
        key: 'active',
        label: 'En estancia',
        description: 'Héspedes actualmente alojados',
        icon: DoorOpen,
        filter: 'activa',
        tone: 'emerald',
    },
    {
        key: 'availableRooms',
        label: 'Habitaciones listas',
        description: 'Disponibles para nuevas reservas',
        icon: BedDouble,
        tone: 'blue',
    },
];

const TONES = {
    rose: 'border-rose-500/20 bg-rose-500/[0.06] text-rose-600 dark:text-rose-400',
    amber: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-600 dark:text-amber-400',
    emerald: 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-600 dark:text-emerald-400',
    blue: 'border-blue-500/20 bg-blue-500/[0.06] text-blue-600 dark:text-blue-400',
};

export default function RecepcionCockpit({ summary, filter, onFilterChange }) {
    return (
        <section aria-labelledby="resumen-operativo" className="space-y-4">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <h2 id="resumen-operativo" className="text-sm font-semibold text-foreground">Resumen operativo</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Hoy: {summary.arrivalsToday} llegada{summary.arrivalsToday === 1 ? '' : 's'} y {summary.departuresToday} salida{summary.departuresToday === 1 ? '' : 's'}.
                    </p>
                </div>
                {summary.cleaningRooms > 0 && (
                    <span className="hidden sm:inline-flex rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-600 dark:text-violet-400">
                        {summary.cleaningRooms} en limpieza
                    </span>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {METRICS.map(metric => {
                    const Icon = metric.icon;
                    const isSelected = metric.filter === filter;
                    const content = (
                        <>
                            <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', TONES[metric.tone])}>
                                <Icon className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 text-left">
                                <p className="text-xl font-bold leading-none tabular-nums text-foreground">
                                    {summary[metric.key]}
                                    {metric.key === 'availableRooms' && <span className="text-xs font-medium text-muted-foreground">/{summary.totalRooms}</span>}
                                </p>
                                <p className="mt-1 truncate text-xs font-semibold text-foreground">{metric.label}</p>
                                <p className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">{metric.description}</p>
                            </div>
                        </>
                    );

                    if (!metric.filter) {
                        return <div key={metric.key} className="enterprise-card flex min-h-24 items-center gap-3 p-3 sm:p-4">{content}</div>;
                    }

                    return (
                        <button
                            key={metric.key}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => onFilterChange(metric.filter)}
                            className={cn(
                                'enterprise-card flex min-h-24 items-center gap-3 p-3 text-left transition-colors sm:p-4',
                                'hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                isSelected && 'border-primary/40 ring-1 ring-primary/20'
                            )}
                        >
                            {content}
                        </button>
                    );
                })}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" role="tablist" aria-label="Filtrar reservas">
                {FILTERS.map(item => (
                    <button
                        key={item.value}
                        type="button"
                        role="tab"
                        aria-selected={filter === item.value}
                        onClick={() => onFilterChange(item.value)}
                        className={cn(
                            'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors',
                            filter === item.value
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border/60 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        )}
                    >
                        {item.label}
                        <span className={cn(
                            'min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] tabular-nums',
                            filter === item.value ? 'bg-primary/15' : 'bg-muted'
                        )}>
                            {summary[item.countKey]}
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
