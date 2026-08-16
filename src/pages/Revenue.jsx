import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
    TrendingUp, ArrowUpRight, ArrowDownRight, 
    Activity, Download, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useHotelData } from '@/hooks/use-hotel-data';
import { format, addDays, isWithinInterval, startOfMonth, endOfMonth, differenceInDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export const Revenue = memo(function Revenue() {
    const { db: hotelDb, hotelId } = useHotelData();

    // Consultas
    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    // Cálculos de KPIs mensuales con comparación contra datos reales del mes anterior.
    const kpis = useMemo(() => {
        const totalHabitaciones = habitaciones.length || 1;
        
        // Mes Actual
        const inicioMes = startOfMonth(new Date());
        const finMes = endOfMonth(new Date());
        const diasMes = differenceInDays(finMes, inicioMes) + 1;
        
        const reservasMes = reservas.filter(r => r.fecha_entrada && r.fecha_salida && isWithinInterval(new Date(r.fecha_entrada), { start: inicioMes, end: finMes }));
        const nochesVendidas = reservasMes.reduce((sum, r) => sum + (r.noches || 1), 0);
        const ingresosMes = reservasMes.reduce((sum, r) => sum + Number(r.total || 0), 0);
        
        const ocupacionPorcentaje = (nochesVendidas / (totalHabitaciones * diasMes)) * 100;
        const adr = nochesVendidas > 0 ? ingresosMes / nochesVendidas : 0;
        const revpar = ingresosMes / (totalHabitaciones * diasMes);

        const mesAnterior = subMonths(new Date(), 1);
        const inicioAnterior = startOfMonth(mesAnterior);
        const finAnterior = endOfMonth(mesAnterior);
        const diasAnterior = differenceInDays(finAnterior, inicioAnterior) + 1;
        const reservasAnterior = reservas.filter(r => r.fecha_entrada && isWithinInterval(new Date(r.fecha_entrada), { start: inicioAnterior, end: finAnterior }));
        const nochesAnterior = reservasAnterior.reduce((sum, r) => sum + Number(r.noches || 1), 0);
        const ingresosAnterior = reservasAnterior.reduce((sum, r) => sum + Number(r.total || 0), 0);
        const ocupacionAnt = (nochesAnterior / (totalHabitaciones * diasAnterior)) * 100;
        const adrAnt = nochesAnterior > 0 ? ingresosAnterior / nochesAnterior : 0;
        const revparAnt = ingresosAnterior / (totalHabitaciones * diasAnterior);
        const trend = (actual, anterior) => anterior > 0 ? ((actual - anterior) / anterior) * 100 : null;

        return {
            ocupacion: ocupacionPorcentaje.toFixed(1),
            ocupacionTrend: trend(ocupacionPorcentaje, ocupacionAnt),
            adr: adr.toFixed(2),
            adrTrend: trend(adr, adrAnt),
            revpar: revpar.toFixed(2),
            revparTrend: trend(revpar, revparAnt)
        };
    }, [reservas, habitaciones]);

    // Forecasting Heurístico (Próximos 7 días)
    const forecastData = useMemo(() => {
        const data = [];
        const hoy = new Date();
        const totalHabitaciones = habitaciones.length || 1;
        let picosDetectados = 0;

        for (let i = 0; i < 7; i++) {
            const fechaEval = addDays(hoy, i);
            const fechaStr = format(fechaEval, 'yyyy-MM-dd');
            const diaSemana = format(fechaEval, 'EEEE', { locale: es });
            
            // Contar cuántas reservas chocan con este día
            const ocupadasHoy = reservas.filter(r => {
                if(r.estado === 'cancelada') return false;
                const inDate = new Date(r.fecha_entrada);
                const outDate = new Date(r.fecha_salida);
                return fechaEval >= inDate && fechaEval < outDate;
            }).length;

            const ocupacion = (ocupadasHoy / totalHabitaciones) * 100;
            if (ocupacion > 75) picosDetectados++;

            data.push({
                fecha: fechaStr,
                dia: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
                ocupacion: Number(ocupacion.toFixed(1)),
                habitaciones: ocupadasHoy
            });
        }
        return { data, picosDetectados };
    }, [reservas, habitaciones]);

    // Exportar Reporte a CSV
    const handleExport = () => {
        const rows = [
            ['Fecha', 'Dia', 'Ocupacion (%)', 'Habitaciones Ocupadas'],
            ...forecastData.data.map(d => [d.fecha, d.dia, d.ocupacion, d.habitaciones])
        ];
        
        let csvContent = "data:text/csv;charset=utf-8,";
        rows.forEach(row => {
            csvContent += row.join(",") + "\r\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `forecast_revenue_${format(new Date(), 'yyyy-MM-dd')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="page-shell page-enter mx-auto max-w-6xl pt-2 sm:pt-4">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-xs">
                        <Activity className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Revenue & BI</h1>
                        <p className="text-muted-foreground mt-0.5 text-xs font-black uppercase tracking-widest">Inteligencia de Negocios y Forecasting</p>
                    </div>
                </div>
                <Button onClick={handleExport} variant="outline" className="h-10 text-xs font-bold gap-2">
                    <Download className="w-4 h-4" /> Exportar CSV
                </Button>
            </div>

            {/* Smart Alert (Recomendador Dinámico) */}
            <div className={`p-5 rounded-2xl border flex items-start sm:items-center gap-4 ${forecastData.picosDetectados > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${forecastData.picosDetectados > 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-emerald-500/20 text-emerald-600'}`}>
                    {forecastData.picosDetectados > 0 ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div>
                    <h3 className={`font-bold text-sm ${forecastData.picosDetectados > 0 ? 'text-amber-900 dark:text-amber-400' : 'text-emerald-900 dark:text-emerald-400'}`}>
                        {forecastData.picosDetectados > 0 ? 'Oportunidad de Yield (Alta Demanda)' : 'Estabilidad Proyectada'}
                    </h3>
                    <p className={`text-xs mt-1 ${forecastData.picosDetectados > 0 ? 'text-amber-700 dark:text-amber-500' : 'text-emerald-700 dark:text-emerald-500'}`}>
                        {forecastData.picosDetectados > 0 
                            ? `Se detectaron ${forecastData.picosDetectados} días en los próximos 7 días con ocupación > 75%. Sugerimos aumentar tu tarifa base en un 15% para maximizar el RevPAR.` 
                            : 'La ocupación para los próximos 7 días está en niveles normales. Mantén tus tarifas base actuales para asegurar flujo.'}
                    </p>
                </div>
                {forecastData.picosDetectados > 0 && (
                    <Button size="sm" variant="outline" className="hidden sm:flex shrink-0 ml-auto bg-amber-500/20 border-amber-500/30 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30">
                        Ir a Yield Management
                    </Button>
                )}
            </div>

            {/* KPIs */}
            <div className="ui-card-grid grid grid-cols-1 sm:grid-cols-3">
                <div className="enterprise-card metric-card ui-card-pad space-y-2">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        RevPAR <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">Mes</span>
                    </p>
                    <div className="flex items-end gap-3">
                        <span className="text-3xl font-black text-foreground">S/ {kpis.revpar}</span>
                        <span className={`flex items-center text-xs font-bold ${kpis.revparTrend == null ? 'text-muted-foreground' : kpis.revparTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {kpis.revparTrend != null && (kpis.revparTrend >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />)}
                            {kpis.revparTrend == null ? 'Sin base previa' : `${Math.abs(kpis.revparTrend).toFixed(1)}%`}
                        </span>
                    </div>
                </div>
                <div className="enterprise-card metric-card ui-card-pad space-y-2">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        ADR <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">Mes</span>
                    </p>
                    <div className="flex items-end gap-3">
                        <span className="text-3xl font-black text-foreground">S/ {kpis.adr}</span>
                        <span className={`flex items-center text-xs font-bold ${kpis.adrTrend == null ? 'text-muted-foreground' : kpis.adrTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {kpis.adrTrend != null && (kpis.adrTrend >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />)}
                            {kpis.adrTrend == null ? 'Sin base previa' : `${Math.abs(kpis.adrTrend).toFixed(1)}%`}
                        </span>
                    </div>
                </div>
                <div className="enterprise-card metric-card ui-card-pad space-y-2">
                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        Ocupación <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px]">Mes</span>
                    </p>
                    <div className="flex items-end gap-3">
                        <span className="text-3xl font-black text-foreground">{kpis.ocupacion}%</span>
                        <span className={`flex items-center text-xs font-bold ${kpis.ocupacionTrend == null ? 'text-muted-foreground' : kpis.ocupacionTrend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {kpis.ocupacionTrend != null && (kpis.ocupacionTrend >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />)}
                            {kpis.ocupacionTrend == null ? 'Sin base previa' : `${Math.abs(kpis.ocupacionTrend).toFixed(1)}%`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Forecasting Chart */}
            <div className="bg-card/40 backdrop-blur-xl rounded-2xl border border-border/50 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="font-bold text-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-primary" /> Forecast de Ocupación
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Proyección de habitaciones ocupadas vs disponibles (Próximos 7 días)</p>
                    </div>
                </div>
                
                <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={forecastData.data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorOcupacion" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={11} tickMargin={10} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} unit="%" domain={[0, 100]} />
                            <Tooltip 
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '12px' }}
                                itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                            />
                            <Area type="monotone" dataKey="ocupacion" name="Ocupación (%)" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorOcupacion)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
})
export default Revenue;
