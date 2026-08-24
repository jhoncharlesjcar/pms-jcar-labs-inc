import React, { memo } from 'react';
import {
    AlertCircle, CheckCircle2, DollarSign, FileText, Landmark, MinusCircle,
    TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';

const money = (value) => `S/ ${Number(value || 0).toFixed(2)}`;

const METHOD_META = [
    { key: 'efectivo', label: 'Efectivo', icon: DollarSign, className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
    { key: 'yape', label: 'Yape', icon: FileText, className: 'text-purple-600 bg-purple-500/10 border-purple-500/20' },
    { key: 'plin', label: 'Plin', icon: FileText, className: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' },
    { key: 'transferencia', label: 'Transferencia', icon: Landmark, className: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { key: 'tarjeta', label: 'Tarjeta', icon: FileText, className: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
];

export const CajaOverview = memo(function CajaOverview(/** @type {any} */ { stats = {} }) {
    const overviewRef = useGsapStaggerList([
        stats?.ingresos, stats?.egresos, stats?.balance, stats?.balanceEfectivo,
    ], { stagger: 0.06, direction: 'scale' });

    const summaryCards = [
        {
            label: 'Ingresos registrados', value: stats.ingresos, hint: `${Number(stats.countHotel || 0) + Number(stats.countPOS || 0)} transacciones`,
            icon: TrendingUp, className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
        },
        {
            label: 'Egresos', value: stats.egresos, hint: `${Number(stats.countEgresos || 0)} salidas`,
            icon: TrendingDown, className: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
        },
        {
            label: 'Saldo neto', value: stats.balance, hint: 'Todos los medios menos egresos',
            icon: Landmark, className: 'text-primary bg-primary/10 border-primary/20',
        },
        {
            label: 'Efectivo esperado', value: stats.balanceEfectivo, hint: 'Efectivo cobrado menos egresos',
            icon: DollarSign, className: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
        },
    ];

    return (
        <section className="space-y-4" aria-label="Resumen de caja del día">
            <div ref={overviewRef} className="ui-card-grid grid grid-cols-2 lg:grid-cols-4">
                {summaryCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <article key={card.label} className="enterprise-card metric-card ui-card-pad flex flex-col justify-center shadow-sm">
                            <div className="flex items-center gap-2.5">
                                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', card.className)}>
                                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{card.label}</p>
                                        <span className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/75">Hoy</span>
                                    </div>
                                    <p className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-foreground">{money(card.value)}</p>
                                </div>
                            </div>
                            <p className="mt-2 truncate border-t border-border/50 pt-2 text-[9px] leading-snug text-muted-foreground">{card.hint}</p>
                        </article>
                    );
                })}
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,1fr)]">
                <article className="enterprise-card section-card ui-card-pad shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" aria-hidden="true" />
                            <div>
                                <h2 className="text-sm font-semibold text-foreground">Dinero por medio de pago</h2>
                                <p className="text-[10px] text-muted-foreground">Lo registrado digitalmente durante el día</p>
                            </div>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-foreground">{money(stats.ingresos)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                        {METHOD_META.map((method) => {
                            const Icon = method.icon;
                            return (
                                <div key={method.key} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                    <div className={cn('mb-2 flex h-7 w-7 items-center justify-center rounded-md border', method.className)}>
                                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                    </div>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{method.label}</p>
                                    <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{money(stats.metodos?.[method.key])}</p>
                                </div>
                            );
                        })}
                    </div>
                </article>

                <article className="enterprise-card section-card ui-card-pad shadow-sm">
                    <div className="mb-4 flex items-center gap-2 border-b border-border/40 pb-3">
                        <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Control tributario</h2>
                            <p className="text-[10px] text-muted-foreground">Comprobantes del día por estado SUNAT</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {[
                            { label: 'Aceptados', count: stats.sunatDeclaradasCount, total: stats.sunatDeclaradasTotal, icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-500/10' },
                            { label: 'Pendientes', count: stats.sunatPendientesCount, total: stats.sunatPendientesTotal, icon: MinusCircle, className: 'text-amber-600 bg-amber-500/10' },
                            { label: 'Rechazados', count: stats.sunatRechazadasCount, total: stats.sunatRechazadasTotal, icon: AlertCircle, className: 'text-rose-600 bg-rose-500/10' },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/40 p-2.5">
                                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md', item.className)}>
                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-foreground">{item.label}</p>
                                        <p className="text-[10px] text-muted-foreground">{Number(item.count || 0)} comprobante(s)</p>
                                    </div>
                                    <p className="text-sm font-bold tabular-nums text-foreground">{money(item.total)}</p>
                                </div>
                            );
                        })}
                    </div>
                </article>
            </div>
        </section>
    );
});

CajaOverview.displayName = 'CajaOverview';
