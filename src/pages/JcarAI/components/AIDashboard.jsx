import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { MessageSquare, CalendarCheck, FileText, TrendingUp, RefreshCw, BarChart3 } from 'lucide-react';

/** @typedef {import('@/types/ai.types').AIMetrics} AIMetrics */

const formatCurrency = (value) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value || 0);

export default function AIDashboard({ hotelId }) {
    const { data: metrics, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['ai-metrics', hotelId],
        queryFn: () => AIService.getMetrics(hotelId),
        refetchInterval: 30000
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-card border border-border rounded-xl">
                        <div className="h-10 bg-muted/50 rounded-t-xl" />
                        <div className="h-24 bg-muted/20" />
                    </div>
                ))}
            </div>
        );
    }
    if (isError) return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">No se pudieron cargar las métricas. {error?.message}<button type="button" onClick={() => refetch()} className="ml-3 underline">Reintentar</button></div>;

    const m = metrics || {
        totalConversations: 0,
        opportunities: 0,
        quotes: 0,
        reservations: 0,
        conversionRate: 0,
        revenue: 0
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    Resumen del Agente IA
                </h2>
                <button 
                    onClick={() => refetch()}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title="Actualizar datos"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel border border-border/50 rounded-xl hover:border-primary/30 transition-all bg-card">
                    <div className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Conversaciones</p>
                            <p className="text-2xl font-bold text-foreground">{m.totalConversations}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel border border-border/50 rounded-xl hover:border-amber-500/30 transition-all bg-card">
                    <div className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Cotizaciones</p>
                            <p className="text-2xl font-bold text-foreground">{m.quotes}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel border border-border/50 rounded-xl hover:border-emerald-500/30 transition-all bg-card">
                    <div className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                            <CalendarCheck className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Reservas Exitosas</p>
                            <p className="text-2xl font-bold text-foreground">{m.reservations}</p>
                            <p className="text-xs font-medium text-emerald-500 mt-1">
                                {m.conversionRate}% Conversión
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass-panel border border-border/50 rounded-xl hover:border-purple-500/30 transition-all bg-gradient-to-br from-card to-purple-500/5">
                    <div className="p-5 flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-muted-foreground">Revenue Generado</p>
                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                {formatCurrency(m.revenue)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Aquí irían gráficos adicionales en V2 */}
            <div className="p-8 border border-dashed border-border rounded-xl text-center flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                <p className="font-medium">Gráficos detallados de conversación próximamente.</p>
                <p className="text-sm opacity-70">El agente está recopilando datos para generar insights de intención.</p>
            </div>
        </div>
    );
}
