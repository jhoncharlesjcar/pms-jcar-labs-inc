import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useGsapCardHover } from '@/hooks/useGsapCardHover';

/** @param {{to: number}} props */
export function Counter({ to }) {
    return <span>{to}</span>;
}

/** @param {{to: number}} props */
export function MoneyCounter({ to }) {
    return <span>{to.toFixed(2)}</span>;
}

const THEME_GLOWS = {
    blue: 'hsla(224, 71%, 50%, 0.18)',
    green: 'hsla(158, 95%, 36%, 0.18)',
    orange: 'hsla(42, 78%, 50%, 0.18)',
    purple: 'hsla(262, 83%, 55%, 0.18)',
    emerald: 'hsla(158, 95%, 36%, 0.18)',
};

/** @param {{kpi: any}} props */
export function KpiCard({ kpi }) {
    const ref = useRef(null);
    const Icon = kpi.icon;
    const variation = kpi.variation;
    const isPositive = variation > 0;
    const isNegative = variation < 0;
    const hasVariation = variation !== null && variation !== undefined && !isNaN(variation);

    useGsapCardHover(ref, {
        scale: 1.02,
        glowColor: THEME_GLOWS[kpi.theme] || 'hsla(var(--primary), 0.15)',
        glowSize: 28,
        duration: 0.3,
    });

    return (
        <div
            ref={ref}
            className={cn(
                'enterprise-card metric-card ui-card-pad relative overflow-hidden flex flex-col justify-between group transition-all duration-300 ease-out hover:-translate-y-1',
                kpi.border
            )}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-110 flex-shrink-0', kpi.bgIcon)}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-none">{kpi.label}</p>
                </div>
                {hasVariation && (
                    <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-xs',
                        isPositive ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' :
                            isNegative ? 'text-red-500 dark:text-red-400 bg-red-500/10' :
                                'text-muted-foreground bg-muted/50'
                    )}>
                        {isPositive ? '↑' : isNegative ? '↓' : '—'} {Math.abs(variation).toFixed(0)}%
                    </span>
                )}
            </div>

            <div className="flex items-baseline gap-0.5 mt-1">
                {kpi.isMoney && <span className="text-sm font-bold text-muted-foreground/80 mr-0.5">S/</span>}
                <p className="font-bold tracking-tight text-foreground text-2xl tabular-nums leading-none">
                    {kpi.isMoney ? <MoneyCounter to={kpi.value} /> : <Counter to={kpi.value} />}
                </p>
                {!kpi.isMoney && kpi.unit && <span className="text-xs font-bold text-muted-foreground/80 ml-0.5">{kpi.unit}</span>}
            </div>

            <p className="text-[9px] text-muted-foreground/60 font-medium mt-2">{kpi.subtitle || 'vs. ayer'}</p>

            <div className={cn('absolute bottom-0 left-4 right-4 h-0.5 rounded-t-sm opacity-70 group-hover:opacity-100 transition-opacity', kpi.barColor)} />
        </div>
    );
}
KpiCard.displayName = 'KpiCard';
