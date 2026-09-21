import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/useHotelData';

export function useVentasData() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [busqueda, setBusqueda] = useState('');
    const [filtroMetodo, setFiltroMetodo] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'hotel' | 'pos'
    const [ventaDetalle, setVentaDetalle] = useState(null);

    const { data: ventasHotel = [], isLoading: loadHotel } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [], isLoading: loadPOS } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list('-created_date'),
        enabled: !!hotelId,
    });

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    const todasLasVentas = useMemo(() => {
        const h = ventasHotel.map(v => ({ ...v, _tipo: 'hotel' }));
        const p = ventasPOS.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta })); 
        return [...h, ...p].sort((a, b) => {
            const dateB = new Date(b.created_date || b.fecha_venta).getTime();
            const dateA = new Date(a.created_date || a.fecha_venta).getTime();
            return dateB - dateA;
        });
    }, [ventasHotel, ventasPOS]);

    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
    
    const totalesHoy = useMemo(() => {
        const deHoy = todasLasVentas.filter(v => {
            const f = (v.fecha_pago || v.fecha_venta || '').split('T')[0];
            return f === hoy;
        });
        return {
            total: deHoy.reduce((s, v) => s + Number(v.total || 0), 0),
            pos: deHoy.filter(v => v._tipo === 'pos').reduce((s, v) => s + Number(v.total || 0), 0),
            hotel: deHoy.filter(v => v._tipo === 'hotel').reduce((s, v) => s + Number(v.total || 0), 0),
        };
    }, [todasLasVentas, hoy]);

    const filtradas = todasLasVentas.filter(v => {
        const nombre = v.huesped_nombre || 'Cliente mostrador';
        const matchBusq = !busqueda || nombre.toLowerCase().includes(busqueda.toLowerCase()) || v.numero_ticket?.includes(busqueda) || v.habitacion_numero?.includes(busqueda);
        const matchMetodo = filtroMetodo === 'todos' || v.metodo_pago === filtroMetodo;
        const matchTipo = filtroTipo === 'todos' || v._tipo === filtroTipo;
        return matchBusq && matchMetodo && matchTipo;
    });

    return {
        qc,
        busqueda, setBusqueda,
        filtroMetodo, setFiltroMetodo,
        filtroTipo, setFiltroTipo,
        ventaDetalle, setVentaDetalle,
        todasLasVentas,
        totalesHoy,
        filtradas,
        config,
        loadHotel,
        loadPOS
    };
}
