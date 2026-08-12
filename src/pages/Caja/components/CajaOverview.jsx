// @ts-nocheck
import React, { memo } from 'react';
import { TrendingUp, TrendingDown, Landmark, FileText } from 'lucide-react';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';

export const CajaOverview = memo(function CajaOverview({ stats = {} }) {
    const overviewRef = useGsapStaggerList([stats?.ingresos, stats?.egresos, stats?.balance], {
        stagger: 0.08,
        direction: 'scale',
    });

    const sunatRef = useGsapStaggerList([stats?.sunatDeclaradasTotal, stats?.sunatPendientesTotal, stats?.sunatRechazadasTotal], {
        stagger: 0.06,
        direction: 'y',
        distance: 12,
    });

    return (
        <div className="space-y-4">
            <div ref={overviewRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="enterprise-card p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-green-600 dark:text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20 shadow-xs">Ingresos</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-1 tabular-nums text-foreground tracking-tighter leading-none">S/ {stats.ingresos.toFixed(2)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">{stats.countHotel + stats.countPOS} transacciones</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-green-500/10 transition-colors" />
                </div>

                <div className="enterprise-card p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 shadow-xs">Egresos</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-1 tabular-nums text-foreground tracking-tighter leading-none">S/ {stats.egresos.toFixed(2)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mt-1.5">{stats.countEgresos} salidas</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-red-500/10 transition-colors" />
                </div>

                <div className="bg-primary/5 backdrop-blur-xl border border-primary/20 p-4 rounded-xl relative overflow-hidden group shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                            <Landmark className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-xs">Balance</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-1 text-primary tabular-nums tracking-tighter leading-none">S/ {stats.balance.toFixed(2)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mt-1.5">Efectivo disponible</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-2xl rounded-full -mr-12 -mt-12" />
                </div>
            </div>

            {/* SUNAT Billing Breakdown */}
            <div ref={sunatRef} className="enterprise-card p-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                    <div className="p-1.5 bg-purple-500/10 rounded-md border border-purple-500/20">
                        <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Resumen de Facturación SUNAT (Hoy)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Declaradas (Emitidas)</span>
                            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">S/ {stats.sunatDeclaradasTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md shadow-xs">{stats.sunatDeclaradasCount}</span>
                        </div>
                    </div>
                    <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Pendientes de Envío</span>
                            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums tracking-tighter">S/ {stats.sunatPendientesTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md shadow-xs">{stats.sunatPendientesCount}</span>
                        </div>
                    </div>
                    <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg flex items-center justify-between shadow-xs">
                        <div>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Rechazadas por SUNAT</span>
                            <span className="text-xl font-extrabold text-red-600 dark:text-red-400 tabular-nums tracking-tighter">S/ {stats.sunatRechazadasTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-black text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md shadow-xs">{stats.sunatRechazadasCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
CajaOverview.displayName = 'CajaOverview';
