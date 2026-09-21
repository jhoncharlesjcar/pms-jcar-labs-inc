import React from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Pie, Cell } from 'recharts';
import { BedDouble, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export const InventoryStatus = ({
    cardRef,
    donutData,
    totalHabitaciones,
    libres,
    ocupadas,
    limpieza,
    mantenimiento,
    ocupacionPct,
    progressBarRef
}) => {
    return (
        <div ref={cardRef} className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col justify-between transition-all duration-300 ease-out lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-sm flex-shrink-0">
                        <BedDouble className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground tracking-tight leading-tight">Estado del Inventario</h3>
                </div>
                <Link to="/habitaciones">
                    <span className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">Ver todas <ArrowUpRight className="w-3 h-3" /></span>
                </Link>
            </div>

            <div className="flex items-center gap-6">
                {/* Donut Chart */}
                <div className="relative h-[140px] w-[140px] flex-shrink-0">
                    <PieChart width={140} height={140}>
                            <Pie
                                data={donutData.length > 0 ? donutData : [{ name: 'Vacío', value: 1, fill: 'hsl(var(--muted))' }]}
                                innerRadius={45}
                                outerRadius={65}
                                paddingAngle={3}
                                dataKey="value"
                                strokeWidth={0}
                                animationBegin={200}
                                animationDuration={1000}
                            >
                                {(donutData.length > 0 ? donutData : [{ fill: 'hsl(var(--muted))' }]).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                    </PieChart>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-bold tabular-nums text-foreground leading-none">{totalHabitaciones}</span>
                        <span className="text-[9px] font-medium text-muted-foreground mt-0.5">Total</span>
                    </div>
                </div>

                {/* Legend + Progress */}
                <div className="flex-1 space-y-2.5">
                    {[
                        { label: "Libres", val: libres, color: "bg-emerald-500", textColor: "text-emerald-500" },
                        { label: "Ocupadas", val: ocupadas, color: "bg-rose-500", textColor: "text-rose-500" },
                        { label: "Limpieza", val: limpieza, color: "bg-purple-500", textColor: "text-purple-500" },
                        { label: "Mantenimiento", val: mantenimiento, color: "bg-amber-500", textColor: "text-amber-500" }
                    ].map(r => (
                        <div key={r.label} className="flex items-center gap-2.5">
                            <div className={cn("w-2 h-2 rounded-full flex-shrink-0", r.color)} />
                            <span className="text-xs font-medium text-muted-foreground flex-1">{r.label}</span>
                            <span className={cn("text-sm font-bold tabular-nums", r.textColor)}>{r.val}</span>
                        </div>
                    ))}

                    {/* Occupancy bar */}
                    <div className="pt-2 border-t border-border/50">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ocupación</span>
                            <span className="text-sm font-bold text-blue-500 tabular-nums">{ocupacionPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div ref={progressBarRef} className="h-full rounded-full bg-blue-500 gsap-progress" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
