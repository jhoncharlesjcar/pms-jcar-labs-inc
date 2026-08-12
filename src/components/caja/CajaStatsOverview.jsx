import { TrendingUp, TrendingDown, Landmark } from 'lucide-react';

export function CajaStatsOverview({ stats }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-foreground/5 flex items-center justify-center shadow-[inset_0_0_15px_rgba(34,197,94,0.15)]">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <span className="text-xs sm:text-xs font-bold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">Ingresos</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-display mb-1 text-foreground">S/ {stats.ingresos.toFixed(2)}</p>
                <p className="text-xs sm:text-xs text-foreground/60">{stats.countHotel + stats.countPOS} transacciones</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-green-500/20 transition-colors pointer-events-none" />
            </div>

            <div className="glass-panel p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-foreground/5 flex items-center justify-center shadow-[inset_0_0_15px_rgba(239,68,68,0.15)]">
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-red-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <span className="text-xs sm:text-xs font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full">Egresos</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-display mb-1 text-foreground">S/ {stats.egresos.toFixed(2)}</p>
                <p className="text-xs sm:text-xs text-foreground/60">{stats.countEgresos} salidas</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-red-500/20 transition-colors pointer-events-none" />
            </div>

            <div className="glass-panel border border-indigo-500/30 p-5 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] relative overflow-hidden group shadow-[inset_0_0_30px_rgba(99,102,241,0.1)]">
                <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-foreground/5 flex items-center justify-center shadow-[inset_0_0_15px_rgba(99,102,241,0.2)]">
                        <Landmark className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <span className="text-xs sm:text-xs font-bold uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-1 rounded-full">Efectivo en Caja</span>
                </div>
                <p className="text-2xl sm:text-3xl font-black font-display mb-1 text-foreground drop-shadow-sm">S/ {stats.balanceEfectivo.toFixed(2)}</p>
                <p className="text-xs sm:text-xs text-indigo-200/80 font-medium">Balance global: S/ {stats.balance.toFixed(2)}</p>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
            </div>
        </div>
    );
}
