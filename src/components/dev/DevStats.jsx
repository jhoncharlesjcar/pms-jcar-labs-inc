import { memo } from 'react';
import { Building2, Users, BedDouble, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @type {React.FC<{ stats: any }>}
 */
const DevStats = memo(function DevStats({ stats }) {
    const cards = [
        { label: 'Hoteles', value: stats.totalHoteles, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Usuarios', value: stats.totalUsuarios, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Reservas activas', value: stats.reservasActivas, icon: BedDouble, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Ingresos totales', value: `S/ ${stats.totalVentas.toFixed(0)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map(s => (
                <div key={s.label} className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-3 shadow-sm">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center mb-1.5 shadow-xs border border-border/20", s.bg)}>
                        <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                    </div>
                    <p className="text-lg font-extrabold text-foreground tracking-tight leading-none mb-0.5">{s.value}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.label}</p>
                </div>
            ))}
        </div>
    );
});
DevStats.displayName = 'DevStats';
export default DevStats;
