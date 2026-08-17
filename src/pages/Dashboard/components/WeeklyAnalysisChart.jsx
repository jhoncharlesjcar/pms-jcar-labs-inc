import React from 'react';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, XAxis, YAxis, Tooltip, Area, ReferenceLine } from 'recharts';

export const WeeklyAnalysisChart = ({ chartData, cardRef }) => {
    return (
        <div ref={cardRef} className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col justify-between overflow-hidden transition-all duration-300 ease-out hover:shadow-md lg:col-span-3">
            <div className="mb-2 flex justify-between items-start">
                <div>
                    <span className="text-xs text-muted-foreground font-medium mb-1 inline-block">Análisis Semanal</span>
                    <h3 className="text-base font-bold text-foreground tracking-tight">Evolución de Ingresos</h3>
                </div>
            </div>
            <div className="flex-1 w-full min-h-[230px] pb-1">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 25 }}>
                        <defs>
                            <linearGradient id="colorHospedaje" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorMinimarket" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--amber-500))" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="hsl(var(--amber-500))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground text-[10px] font-medium" tickLine={false} axisLine={false} dy={6} />
                        <YAxis stroke="currentColor" className="text-muted-foreground text-[10px] font-medium" tickLine={false} axisLine={false} tickFormatter={r => `S/${r}`} domain={[0, dataMax => Math.max(dataMax || 0, 1000)]} allowDecimals={false} />
                        <Tooltip cursor={{ fill: "rgba(var(--foreground), 0.03)" }} contentStyle={{ background: "hsl(var(--card))", backdropFilter: "blur(16px)", border: "1px solid hsl(var(--border))", borderRadius: "1rem", color: "hsl(var(--foreground))", fontSize: "12px", fontWeight: "bold" }} />
                        <Area type="monotone" dataKey="Hospedaje" stackId="a" fill="url(#colorHospedaje)" stroke="hsl(var(--primary))" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 4, stroke: 'hsl(var(--background))' }} />
                        <Area type="monotone" dataKey="Minimarket" stackId="a" fill="url(#colorMinimarket)" stroke="hsl(var(--amber-500))" strokeWidth={3} activeDot={{ r: 6, strokeWidth: 4, stroke: 'hsl(var(--background))' }} />
                        <Area type="monotone" dataKey="Proyeccion" stroke="hsl(var(--primary))" strokeDasharray="5 5" fill="none" strokeWidth={2} activeDot={{ r: 5, stroke: 'hsl(var(--primary))' }} />
                        <ReferenceLine x={format(new Date(), 'dd/MM')} stroke="hsl(var(--primary)/0.6)" strokeDasharray="4 4" label={{ value: 'HOY', fill: 'hsl(var(--primary))', fontSize: 9, position: 'top', fontWeight: '900' }} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
