import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/useHotelData';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, parseISO } from 'date-fns';
import { consolidarVentas } from '@/services/ventas.service';

export function useReportesData() {
    const { db: hotelDb, hotelId } = useHotelData();
    const [periodo, setPeriodo] = useState('mes'); // dia, mes, año, personalizado
    const [tipoReporte, setTipoReporte] = useState('ambos'); // ambos, hotel, pos
    const [turno, setTurno] = useState('completo'); // completo, mañana, tarde, noche
    const [fechaInicio, setFechaInicio] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    const [fechaFin, setFechaFin] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

    const { data: ventasHotel = [], isLoading: isLoadingHotel } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [], isLoading: isLoadingPOS } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!hotelId,
    });

    const todasLasVentas = useMemo(
        () => consolidarVentas(ventasHotel, ventasPOS),
        [ventasHotel, ventasPOS],
    );

    const filtradas = useMemo(() => {
        let start = parseISO(fechaInicio);
        let end = parseISO(fechaFin);

        if (periodo === 'dia') {
            start = startOfDay(new Date());
            end = endOfDay(new Date());
        } else if (periodo === 'mes') {
            start = startOfMonth(new Date());
            end = endOfMonth(new Date());
        } else if (periodo === 'año') {
            start = startOfYear(new Date());
            end = endOfYear(new Date());
        }

        return todasLasVentas
            .filter(v => {
                if (!v.fecha_pago) return false;
                const f = parseISO(v.fecha_pago);
                return isWithinInterval(f, { start, end });
            })
            .filter(v => {
                if (tipoReporte === 'ambos') return true;
                return v._tipo === tipoReporte;
            })
            .filter(v => {
                if (turno === 'completo') return true;
                if (!v.fecha_pago) return false;
                const hora = new Date(v.fecha_pago).getHours();
                if (turno === 'mañana') return hora >= 7 && hora < 15;
                if (turno === 'tarde') return hora >= 15 && hora < 23;
                if (turno === 'noche') return hora >= 23 || hora < 7;
                return true;
            });
    }, [todasLasVentas, periodo, tipoReporte, turno, fechaInicio, fechaFin]);

    const stats = useMemo(() => {
        const total = filtradas.reduce((sum, v) => sum + Number(v.total || 0), 0);
        const hotel = filtradas.filter(v => v._tipo === 'hotel').reduce((sum, v) => sum + Number(v.total || 0), 0);
        const pos = filtradas.filter(v => v._tipo === 'pos').reduce((sum, v) => sum + Number(v.total || 0), 0);
        
        const metodos = filtradas.reduce((acc, v) => {
            const m = v.metodo_pago || 'efectivo';
            acc[m] = (acc[m] || 0) + Number(v.total || 0);
            return acc;
        }, {});

        const metodosData = Object.entries(metodos).map(([name, value]) => ({ name: name.toUpperCase(), value }));

        const porFecha = filtradas.reduce((acc, v) => {
            const fechaKey = v.fecha_pago ? v.fecha_pago.split('T')[0] : 'Sin fecha';
            if (!acc[fechaKey]) acc[fechaKey] = { fecha: fechaKey, hotel: 0, pos: 0, total: 0 };
            const monto = Number(v.total || 0);
            if (v._tipo === 'hotel') acc[fechaKey].hotel += monto;
            else acc[fechaKey].pos += monto;
            acc[fechaKey].total += monto;
            return acc;
        }, {});

        const lineData = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

        return { total, hotel, pos, metodosData, lineData };
    }, [filtradas]);

    return {
        periodo, setPeriodo,
        tipoReporte, setTipoReporte,
        turno, setTurno,
        fechaInicio, setFechaInicio,
        fechaFin, setFechaFin,
        filtradas,
        stats,
        isLoading: isLoadingHotel || isLoadingPOS
    };
}
