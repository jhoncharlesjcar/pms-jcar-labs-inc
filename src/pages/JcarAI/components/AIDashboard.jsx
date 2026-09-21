import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { MessageSquare, CalendarCheck, FileText, TrendingUp, RefreshCw } from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

/** @typedef {import('@/types/ai.types').AIMetrics} AIMetrics */

const formatCurrency = (value) =>
    new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value || 0);

const COLORS = {
    blue: '#3b82f6',
    amber: '#f59e0b',
    emerald: '#10b981',
    purple: '#8b5cf6',
};

export default function AIDashboard({ hotelId }) {
    const { data: metrics, isLoading, isError, error, refetch } = useQuery({
        queryKey: ['ai-metrics', hotelId],
        queryFn: () => AIService.getMetrics(hotelId),
        refetchInterval: 30000,
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

    if (isError) {
        return (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
                No se pudieron cargar las métricas. {error?.message}
                <button type="button" onClick={() => refetch()} className="ml-3 underline">
                    Reintentar
                </button>
            </div>
        );
    }

    /** @type {AIMetrics} */
    const m = metrics || {
        totalConversations: 0,
        opportunities: 0,
        quotes: 0,
        reservations: 0,
        conversionRate: 0,
        revenue: 0,
    };

    const funnelData = [
        { name: 'Conversaciones', value: m.totalConversations },
        { name: 'Oportunidades', value: m.opportunities },
        { name: 'Cotizaciones', value: m.quotes },
        { name: 'Reservas', value: m.reservations },
    ];

    const pieData = funnelData.filter((item) => item.value > 0);
    const hasChartData = pieData.length > 0;
    const pieColors = [COLORS.blue, COLORS.amber, COLORS.emerald, COLORS.purple];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">Resumen del Agente IA</h2>
                <button
                    type="button"
                    onClick={() => refetch()}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                    title="Actualizar datos"
                    aria-label="Actualizar métricas"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPIcard
                    icon={<MessageSquare className="w-6 h-6" />}
                    iconBg="bg-blue-500/10 text-blue-500"
                    label="Conversaciones"
                    value={m.totalConversations}
                    accent="border-primary/30"
                />
                <KPIcard
                    icon={<FileText className="w-6 h-6" />}
                    iconBg="bg-amber-500/10 text-amber-500"
                    label="Cotizaciones"
                    value={m.quotes}
                    accent="border-amber-500/30"
                />
                <KPIcard
                    icon={<CalendarCheck className="w-6 h-6" />}
                    iconBg="bg-emerald-500/10 text-emerald-500"
                    label="Reservas Exitosas"
                    value={m.reservations}
                    subtext={`${m.conversionRate}% Conversión`}
                    accent="border-emerald-500/30"
                />
                <KPIcard
                    icon={<TrendingUp className="w-6 h-6" />}
                    iconBg="bg-purple-500/10 text-purple-500"
                    label="Revenue Generado"
                    value={formatCurrency(m.revenue)}
                    accent="border-purple-500/30"
                    gradient
                />
            </div>

            {hasChartData ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-border bg-card p-6">
                        <h3 className="mb-4 text-lg font-semibold">Embudo de conversión</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        formatter={(value) => [value, 'Cantidad']}
                                        contentStyle={{ borderRadius: 8, border: '1px solid var(--border)' }}
                                    />
                                    <Bar dataKey="value" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-6">
                        <h3 className="mb-4 text-lg font-semibold">Participación en el pipeline</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value, name) => [value, name]}
                                        contentStyle={{ borderRadius: 8, border: '1px solid var(--border)' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center text-muted-foreground">
                    <p className="font-medium">Aún no hay datos suficientes para graficar.</p>
                    <p className="text-sm opacity-70">Los gráficos aparecen cuando JcarAI registra conversaciones.</p>
                </div>
            )}
        </div>
    );
}

function KPIcard({ icon, iconBg, label, value, subtext = null, accent = '', gradient = false }) {
    return (
        <div
            className={`rounded-xl border border-border/50 ${accent || ''} ${
                gradient ? 'bg-gradient-to-br from-card to-purple-500/5' : 'bg-card'
            } hover:border-primary/30 transition-all`}
        >
            <div className="p-5 flex items-center gap-4">
                <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold text-foreground">{value}</p>
                    {subtext && <p className="text-xs font-medium text-emerald-500 mt-1">{subtext}</p>}
                </div>
            </div>
        </div>
    );
}
