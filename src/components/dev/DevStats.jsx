import { Building2, Users, BedDouble, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DevStats({ stats }) {
    const cards = [
        { label: 'Hoteles', value: stats.totalHoteles, icon: Building2, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Usuarios', value: stats.totalUsuarios, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
        { label: 'Reservas activas', value: stats.reservasActivas, icon: BedDouble, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Ingresos totales', value: `S/ ${stats.totalVentas.toFixed(0)}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cards.map(s => (
                <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-2", s.bg)}>
                        <s.icon className={cn("w-4 h-4", s.color)} />
                    </div>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
            ))}
        </div>
    );
}
