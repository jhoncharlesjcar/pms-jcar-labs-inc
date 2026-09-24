import React from 'react';
import { Trophy, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function TopGuestsWidget({ huespedes, isLoading }) {
    if (isLoading) {
        return (
            <div className="enterprise-card section-card ui-card-pad flex flex-col shadow-sm min-h-[300px] animate-pulse">
                <div className="h-4 w-40 bg-muted rounded mb-6"></div>
                <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-muted rounded"></div>
                                <div className="h-2 w-16 bg-muted rounded"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const topGuests = huespedes
        .filter(h => h.totalGasto > 0)
        .sort((a, b) => b.totalGasto - a.totalGasto)
        .slice(0, 5);

    if (topGuests.length === 0) {
        return (
            <div className="enterprise-card section-card ui-card-pad flex flex-col items-center justify-center shadow-sm min-h-[300px]">
                <div className="w-12 h-12 bg-muted/30 rounded-xl flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-xs font-bold text-muted-foreground">Sin datos suficientes</p>
            </div>
        );
    }

    return (
        <div className="enterprise-card section-card ui-card-pad flex flex-col shadow-sm">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-5">
                <Trophy className="w-3.5 h-3.5 text-amber-500" /> Top Huéspedes por Gasto
            </h2>
            <div className="flex-1 flex flex-col gap-3">
                {topGuests.map((h, i) => {
                    const rankColors = {
                        0: 'text-amber-500 bg-amber-500/10 border-amber-500/20', // Oro
                        1: 'text-slate-400 bg-slate-400/10 border-slate-400/20', // Plata
                        2: 'text-amber-700 bg-amber-700/10 border-amber-700/20'  // Bronce
                    };
                    const badgeColor = rankColors[i] || 'text-muted-foreground bg-muted border-border/50';

                    return (
                        <div key={h.dni || h.nombre} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border/50">
                            <div className={cn("w-7 h-7 rounded-md flex items-center justify-center font-black text-xs border shadow-sm shrink-0", badgeColor)}>
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-extrabold text-foreground truncate leading-none">{h.nombre}</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 flex items-center gap-1 truncate">
                                    <MapPin className="w-2.5 h-2.5" /> {h.procedencia || 'No registrada'}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
                                    S/ {h.totalGasto?.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1 text-right">
                                    {h.totalEstancias} {h.totalEstancias === 1 ? 'visita' : 'visitas'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
