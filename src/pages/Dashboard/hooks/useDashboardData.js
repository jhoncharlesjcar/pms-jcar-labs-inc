import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { format, subDays } from 'date-fns';
import logger from '@/lib/logger';
import { calcularDesgloseMetodosPago, calcularDesgloseSunat } from '@/services/caja.service';

export function useDashboardData(user, hotelId, db) {
    const [queueCount, setQueueCount] = useState(0);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);

    useEffect(() => {
        const handleOffline = () => setIsOffline(true);
        const handleOnline = () => setIsOffline(false);
        const handleQueue = (e) => setQueueCount(e.detail);

        window.addEventListener('offline', handleOffline);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline_queue_updated', handleQueue);

        // Initial check
        if (user?.id && hotelId) {
            import('@/lib/sync-queue').then(m => m.getPendingCount(user.id, hotelId).then(setQueueCount));
        }

        return () => {
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline_queue_updated', handleQueue);
        };
    }, [user?.id, hotelId]);

    const { data: reservas = [] } = useQuery({
        queryKey: ["reservas", hotelId],
        queryFn: () => db.Reserva.list(null, null, "id, estado, fecha_entrada, total, fecha_salida, huesped_nombre, habitacion_numero"),
        enabled: !!hotelId
    });

    const { data: ventasHotel = [] } = useQuery({
        queryKey: ["ventas", hotelId, "7d"],
        queryFn: async () => {
            const hace7Dias = new Date();
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            const { data } = await supabase
                .from('ventas')
                .select('id, total, fecha_pago, created_date, metodo_pago, estado_comprobante, numero_ticket, huesped_nombre, habitacion_numero')
                .eq('hotel_id', hotelId)
                .gte('created_date', hace7Dias.toISOString())
                .order('created_date', { ascending: false });
            return data || [];
        },
        enabled: !!hotelId
    });

    const { data: ventasPos = [] } = useQuery({
        queryKey: ["ventaspos", hotelId, "7d"],
        queryFn: async () => {
            const hace7Dias = new Date();
            hace7Dias.setDate(hace7Dias.getDate() - 7);
            const { data } = await supabase
                .from('ventas_pos')
                .select('id, total, fecha_venta, created_date, metodo_pago, estado_comprobante, numero_ticket, huesped_nombre, habitacion_numero')
                .eq('hotel_id', hotelId)
                .gte('created_date', hace7Dias.toISOString())
                .order('created_date', { ascending: false });
            return data || [];
        },
        enabled: !!hotelId
    });

    const { data: dbStats = null } = useQuery({
        queryKey: ["dashboardStats", hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_dashboard_stats', { p_hotel_id: hotelId });
            if (error) {
                logger.error("Error fetching RPC stats:", error);
                return null;
            }
            return data;
        },
        enabled: !!hotelId,
        refetchInterval: 60000 // Refetch every 60s as this is a fast RPC
    });

    const metrics = useMemo(() => {
        const hoy = new Date();
        const hoyYMD = format(hoy, 'yyyy-MM-dd');

        const todasLasVentas = [
            ...ventasHotel.map(v => ({ ...v, _tipo: 'hotel' })),
            ...ventasPos.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta }))
        ];
        const ventasHoy = todasLasVentas.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === hoyYMD);
        const metodosHoy = calcularDesgloseMetodosPago(ventasHoy);
        const sunatHoy = calcularDesgloseSunat(ventasHoy);

        // Chart Data calculations using only the last 7 days of local data
        const chartData = Array.from({ length: 10 }).map((_, i) => {
            const d = subDays(hoy, 6 - i);
            const ymd = format(d, 'yyyy-MM-dd');
            const ddm = format(d, 'dd/MM');
            const esFuturo = i > 6;

            let sumHotel = 0;
            let sumPos = 0;

            if (esFuturo) {
                sumHotel = reservas.filter(r =>
                    (r.fecha_entrada || '').startsWith(ymd) && ['pendiente', 'activa'].includes(r.estado)
                ).reduce((acc, r) => acc + Number(r.total || 0), 0);
            } else {
                sumHotel = ventasHotel.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === ymd).reduce((acc, v) => acc + Number(v.total || 0), 0);
                sumPos = ventasPos.filter(v => (v.fecha_venta || v.created_date || '').split('T')[0] === ymd).reduce((acc, v) => acc + Number(v.total || 0), 0);
            }

            return {
                name: ddm,
                Hospedaje: !esFuturo ? sumHotel : null,
                Minimarket: !esFuturo ? sumPos : null,
                Proyeccion: i >= 6 ? (sumHotel + sumPos) : null,
                Total: sumHotel + sumPos,
                esFuturo
            };
        });

        const llegadasHoy = reservas.filter(r => (r.fecha_entrada || '').startsWith(hoyYMD) && ['pendiente', 'activa'].includes(r.estado));
        const salidasHoy = reservas.filter(r => (r.fecha_salida || '').startsWith(hoyYMD) && ['activa'].includes(r.estado));

        // Cálculo de variaciones vs ayer
        const ayerYMD = format(subDays(hoy, 1), 'yyyy-MM-dd');
        const ingresosAyer = ventasHotel.filter(v => (v.fecha_pago || v.created_date || '').split('T')[0] === ayerYMD).reduce((s, v) => s + Number(v.total || 0), 0)
            + ventasPos.filter(v => (v.fecha_venta || v.created_date || '').split('T')[0] === ayerYMD).reduce((s, v) => s + Number(v.total || 0), 0);

        const ingresosHoyCalc = dbStats?.ingresos_hoy || 0;
        const variacionIngresos = ingresosAyer > 0 ? ((ingresosHoyCalc - ingresosAyer) / ingresosAyer * 100) : null;

        const ocupadasAyerCalc = reservas.filter(r => (r.fecha_entrada || '') <= ayerYMD && (r.fecha_salida || '') > ayerYMD && ['activa', 'finalizada'].includes(r.estado)).length;
        const libresAyerCalc = (dbStats?.habitaciones_total || 0) - ocupadasAyerCalc;
        const reservasAyerCalc = reservas.filter(r => (r.fecha_entrada || '') <= ayerYMD && (r.fecha_salida || '') > ayerYMD && ['activa', 'finalizada', 'pendiente'].includes(r.estado)).length;

        const variacionOcupacion = ocupadasAyerCalc > 0 ? (((dbStats?.ocupadas || 0) - ocupadasAyerCalc) / ocupadasAyerCalc * 100) : null;
        const variacionLibres = libresAyerCalc > 0 ? (((dbStats?.libres || 0) - libresAyerCalc) / libresAyerCalc * 100) : null;
        const variacionReservas = reservasAyerCalc > 0 ? (((dbStats?.ocupadas_y_pendientes || 0) - reservasAyerCalc) / reservasAyerCalc * 100) : null;

        return {
            libres: dbStats?.libres || 0,
            ocupadas: dbStats?.ocupadas || 0,
            reservasActivas: dbStats?.reservas_activas || 0,
            mantenimiento: dbStats?.mantenimiento || 0,
            limpieza: dbStats?.limpieza || 0,
            todasLasVentas,
            ingresosHoy: ingresosHoyCalc,
            ocupacionPct: dbStats?.ocupacion_pct || 0,
            adr: dbStats?.ocupadas > 0 ? (dbStats.ingresos_hoy / dbStats.ocupadas) : 0,
            revpar: dbStats?.habitaciones_total > 0 ? (dbStats.ingresos_hoy / dbStats.habitaciones_total) : 0,
            chartData,
            ocupadasYPendientes: dbStats?.ocupadas_y_pendientes || 0,
            ingresosHospedajeHoy: dbStats?.ingresos_hospedaje_hoy || 0,
            ingresosPosHoy: dbStats?.ingresos_pos_hoy || 0,
            acumuladoMes: dbStats?.acumulado_mes || 0,
            ticketsPOS: dbStats?.tickets_pos || 0,
            llegadasHoy,
            salidasHoy,
            variacionIngresos,
            variacionOcupacion,
            variacionLibres,
            variacionReservas,
            habitacionesTotal: dbStats?.habitaciones_total || 0,
            metodosHoy,
            sunatHoy,
            transaccionesHoy: ventasHoy.length,
        };
    }, [ventasHotel, ventasPos, reservas, dbStats]);

    return {
        queueCount,
        isOffline,
        metrics
    };
}
