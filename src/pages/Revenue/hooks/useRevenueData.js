import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/useHotelData';
import { format, addDays, isWithinInterval, startOfMonth, endOfMonth, differenceInDays, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export function useRevenueData() {
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

    return {
        hotelId,
        kpis,
        forecastData
    };
}
