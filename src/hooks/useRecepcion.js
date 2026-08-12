import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/use-hotel-data';
import { useAuth } from '@/contexts/AuthContext';
import { registrarLog } from '@/lib/auditLogger';
import { toast } from 'sonner';
import { WhatsAppService } from '@/services/whatsapp.service';

export function useRecepcion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const { user } = useAuth();

    const checkins = useQuery({
        queryKey: ['checkins_publicos', hotelId],
        queryFn: () => hotelDb.CheckinPublico.list(),
        enabled: !!hotelId,
        retry: false,
    });

    const rechazarCheckin = useMutation({
        mutationFn: (id) => hotelDb.CheckinPublico.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['checkins_publicos'] });
            toast.success("Pre-registro descartado correctamente");
        },
        onError: () => toast.error("Error al descartar pre-registro")
    });

    const reservas = useQuery({
        queryKey: ['reservas', hotelId, 'recientes'],
        queryFn: () => {
            const haceUnaSemana = new Date();
            haceUnaSemana.setDate(haceUnaSemana.getDate() - 7);
            const fechaMin = haceUnaSemana.toISOString().split('T')[0];
            return hotelDb.Reserva.customQuery(q => q.gte('fecha_salida', fechaMin));
        },
        enabled: !!hotelId,
    });

    const habitaciones = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const ventas = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const configs = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });

    const tarifas = useQuery({
        queryKey: ['tarifas_dinamicas', hotelId],
        queryFn: () => hotelDb.TarifaDinamica.list(),
        enabled: !!hotelId,
        retry: false,
    });

    const ventasPOS = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!hotelId,
    });

    return {
        hotelId,
        user,
        hotelDb,
        qc,
        checkins: checkins.data || [],
        reservas: reservas.data || [],
        habitaciones: habitaciones.data || [],
        ventas: ventas.data || [],
        configs: configs.data || [],
        tarifas: tarifas.data || [],
        ventasPOS: ventasPOS.data || [],
        rechazarCheckin
    };
}
