import { cn } from '@/lib/utils';
import { Wallet, ShoppingCart, Hotel } from 'lucide-react';

export function VentasResumenCards({ totalesHoy, todasLasVentas }) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
                { label: 'Minimarket', val: totalesHoy.pos, icon: ShoppingCart, color: 'text-amber-400 drop-shadow-[0_0_10px_currentColor] brightness-110', bg: 'glass-panel border-amber-500/20 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]' },
                { label: 'Hotel Hoy', val: totalesHoy.hotel, icon: Hotel, color: 'text-blue-400 drop-shadow-[0_0_10px_currentColor] brightness-110', bg: 'glass-panel border-blue-500/20 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' },
                { label: 'Histórico', val: todasLasVentas.reduce((s, v) => s + Number(v.total || 0), 0), icon: Wallet, color: 'text-emerald-400 drop-shadow-[0_0_10px_currentColor] brightness-110', bg: 'glass-panel border-emerald-500/20 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]' },
            ].map((stat, i) => (
                <div 
                    key={stat.label}
                    className={cn("p-4 sm:p-6 rounded-[1.5rem] sm:rounded-3xl border shadow-sm relative overflow-hidden", stat.bg)}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-foreground/5 blur-3xl -z-10 rounded-full pointer-events-none" />
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", stat.color)} />
                        <p className="text-[9px] sm:text-xs font-black text-foreground/60 uppercase tracking-widest">{stat.label}</p>
                    </div>
                    <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                </div>
            ))}
        </div>
    );
}
