import React, { useState, useEffect, useRef, memo } from 'react';
import { History, MinusCircle, Calendar, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import EmptyState from '@/components/common/EmptyState';

export const CajaListEgresos = memo(function CajaListEgresos({ egresos }) {
    const [filterTab, setFilterTab] = useState('hoy');
    const listRef = useRef(null);

    // GSAP stagger en egresos — solo cuando hay datos reales
    useEffect(() => {
        if (!listRef.current) return;
        if (egresos.length === 0) return;
        const children = listRef.current.children;
        if (children.length === 0) return;

        gsap.fromTo(
            children,
            { opacity: 0, x: -15 },
            {
                opacity: 1,
                x: 0,
                duration: 0.35,
                ease: 'power3.out',
                stagger: {
                    each: 0.04,
                    from: 'start',
                },
            }
        );
    }, [filterTab, egresos.length]);

    return (
        <div className="lg:col-span-2 space-y-5">
            <div className="flex items-center justify-between px-2 pb-2 border-b border-border/40">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-muted/50 rounded-md border border-border/40">
                        <History className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <h3 className="font-extrabold text-sm tracking-tight text-foreground">Movimientos Recientes</h3>
                </div>
                <div className="flex gap-1 bg-muted/50 p-1 rounded-lg border border-border/40">
                    {['hoy', 'semana', 'todos'].map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterTab(t)}
                            className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-widest transition-all",
                                filterTab === t ? "bg-background text-foreground shadow-sm border border-border/40" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div ref={listRef} className="space-y-3">
                {egresos.length > 0 ? (
                    egresos.slice(0, 10).map((e) => (
                        <div
                            key={e.id}
                            className="bg-card/40 backdrop-blur-xl border border-border/40 p-3 rounded-xl flex items-center justify-between hover:bg-muted/30 transition-all shadow-sm group hover:-translate-y-0.5"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-xs group-hover:scale-105 transition-transform">
                                    <MinusCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="font-extrabold text-xs text-foreground tracking-tight">{e.concepto || 'Egreso sin concepto'}</p>
                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                        <Calendar className="w-3 h-3" />
                                        <span className="truncate max-w-[80px] sm:max-w-none">{format(new Date(e.fecha || e.created_date), "dd MMM, HH:mm", { locale: es })}</span>
                                        <span className="opacity-30">•</span>
                                        <User className="w-3 h-3" />
                                        <span className="truncate max-w-[60px] sm:max-w-none">{e.usuario_nombre || 'Staff'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-extrabold text-red-600 dark:text-red-400 tabular-nums text-base leading-none tracking-tighter">- S/ {Number(e.monto).toFixed(2)}</p>
                                <span className="inline-block mt-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border/40 shadow-xs">{e.categoria || 'Operativo'}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyState
                        icon={AlertCircle}
                        title="No se registran egresos recientes"
                        description="Los egresos registrados en el día aparecerán aquí automáticamente."
                        className="py-10"
                    />
                )}
            </div>
        </div>
    );
});
CajaListEgresos.displayName = 'CajaListEgresos';
