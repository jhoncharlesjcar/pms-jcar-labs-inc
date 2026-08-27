import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/useHotelData';
import { format } from 'date-fns';

export function useHuespedesData() {
    const { db: hotelDb, hotelId } = useHotelData();
    const [busqueda, setBusqueda] = useState('');
    const [orden, setOrden] = useState('nombre');
    const [activeTab, setActiveTab] = useState('directorio');
    const [selectedHuesped, setSelectedHuesped] = useState(null);
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [periodoExport, setPeriodoExport] = useState('mes');
    const [fechaExport, setFechaExport] = useState(format(new Date(), 'yyyy-MM-dd'));

    const { data: reservas = [], isLoading } = useQuery({
        queryKey: ['reservas-huespedes', hotelId],
        queryFn: () => hotelDb.Reserva.list(null, null, "*, observaciones"),
        enabled: !!hotelId,
    });

    const huespedes = useMemo(() => {
        return reservas.reduce((acc, res) => {
            const key = res.huesped_dni || res.huesped_nombre;
            if (!acc[key]) {
                acc[key] = {
                    nombre: res.huesped_nombre,
                    dni: res.huesped_dni,
                    telefono: res.huesped_telefono,
                    procedencia: res.huesped_procedencia,
                    totalEstancias: 0,
                    totalGasto: 0,
                    ultimaVisita: res.fecha_entrada,
                    habitacionFavorita: res.habitacion_numero,
                    tipoHabFavorita: res.habitacion_tipo,
                    registradoDesde: res.created_date || res.fecha_entrada,
                    email: 'No registrado',
                    nacionalidad: res.huesped_procedencia || 'No registrada',
                    nochesTotales: 0,
                    observaciones: res.observaciones || '',
                    reservas: []
                };
            }
            
            acc[key].totalEstancias += 1;
            acc[key].totalGasto += (res.total || 0);
            acc[key].nochesTotales += Number(res.noches || 0);
            acc[key].reservas.push(res);
            
            if (new Date(res.fecha_entrada) > new Date(acc[key].ultimaVisita)) {
                acc[key].ultimaVisita = res.fecha_entrada;
                acc[key].habitacionFavorita = res.habitacion_numero;
                acc[key].tipoHabFavorita = res.habitacion_tipo;
                if (res.observaciones) {
                    acc[key].observaciones = res.observaciones;
                }
            }
            
            return acc;
        }, {});
    }, [reservas]);

    const listaHuespedes = useMemo(() => {
        return Object.values(huespedes).filter(h => {
            const b = busqueda.toLowerCase();
            return (
                h.nombre?.toLowerCase().includes(b) ||
                h.dni?.toLowerCase().includes(b) ||
                h.procedencia?.toLowerCase().includes(b)
            );
        }).sort((a, b) => {
            if (orden === 'nombre') return a.nombre.localeCompare(b.nombre);
            if (orden === 'estancias') return b.totalEstancias - a.totalEstancias;
            return 0;
        });
    }, [huespedes, busqueda, orden]);

    return {
        busqueda, setBusqueda,
        orden, setOrden,
        activeTab, setActiveTab,
        selectedHuesped, setSelectedHuesped,
        exportDialogOpen, setExportDialogOpen,
        periodoExport, setPeriodoExport,
        fechaExport, setFechaExport,
        reservas,
        isLoading,
        listaHuespedes
    };
}
