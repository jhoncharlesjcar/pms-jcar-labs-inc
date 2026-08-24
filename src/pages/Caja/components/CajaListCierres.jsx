import React, { useEffect, useRef, memo } from 'react';
import { History, CheckCircle2, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { gsap } from 'gsap';
import EmptyState from '@/components/common/EmptyState';

export const CajaListCierres = memo(function CajaListCierres(/** @type {any} */ { cierres }) {
    const listRef = useRef(null);

    // GSAP stagger en cierres — solo cuando hay datos reales
    useEffect(() => {
        if (!listRef.current) return;
        if (cierres.length === 0) return;
        const children = listRef.current.children;
        if (children.length === 0) return;

        gsap.fromTo(
            children,
            { opacity: 0, y: 15, scale: 0.97 },
            {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.4,
                ease: 'power3.out',
                stagger: {
                    each: 0.06,
                    from: 'start',
                },
            }
        );
    }, [cierres.length]);

    return (
        <div className="space-y-5">
            <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/40">
                <div className="p-1.5 bg-muted/50 rounded-md border border-border/40">
                    <History className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <h3 className="font-extrabold text-sm tracking-tight text-foreground">Historial de Cierres</h3>
            </div>

            <div ref={listRef} className="space-y-3">
                {cierres.length > 0 ? (
                    cierres.slice(0, 5).map((c) => (
                        <div key={c.id} className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl relative overflow-hidden shadow-sm group hover:-translate-y-1 hover:shadow-md transition-all">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary/10"></div>
                            <div className="flex justify-between items-start mb-3 pt-1">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 shadow-xs mb-1.5 inline-block">Cierre de Caja</p>
                                    <p className="font-extrabold text-xs tracking-tight capitalize">{format(new Date(c.fecha || c.created_date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                                </div>
                                <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center border border-green-500/20 shadow-xs group-hover:scale-105 transition-transform">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border/40">
                                <div>
                                    <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Total Ventas</p>
                                    <p className="font-extrabold text-xs text-foreground tabular-nums">S/ {Number(c.total_ventas).toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest mb-0.5">Saldo Final</p>
                                    <p className="font-extrabold text-xs text-primary tabular-nums">S/ {Number(c.saldo_final).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 bg-muted/30 p-1.5 rounded-lg border border-border/30">
                                <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-xs">
                                    <span className="text-[9px] font-black uppercase">{(c.usuario_nombre || '?')[0]}</span>
                                </div>
                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Cerrado por {c.usuario_nombre || 'Sistema'}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <EmptyState
                        icon={Archive}
                        title="Aún no hay cierres registrados"
                        description="Los cierres de caja aparecerán aquí después del primer arqueo del día."
                        className="py-10"
                    />
                )}
            </div>
        </div>
    );
});
CajaListCierres.displayName = 'CajaListCierres';
