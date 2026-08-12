import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReservasService } from '@/services/reservas.service';
import { Reserva } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';

export function useReservas() {
  const queryClient = useQueryClient();
  const { hotelId } = useAuthStore();

  // Query para obtener reservas
  const {
    data: reservas = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['reservas', hotelId],
    queryFn: () => {
      if (!hotelId) return [];
      return ReservasService.getReservasByHotel(hotelId);
    },
    enabled: !!hotelId,
    staleTime: 60000, // 1 minuto (cambia moderadamente rápido)
    gcTime: 1000 * 60 * 10 // 10 minutos de cache
  });

  // Mutation para registrar reserva
  const crearReservaMutation = useMutation({
    mutationFn: (nuevaReserva: Omit<Reserva, 'id' | 'hotel_id'>) => {
      if (!hotelId) throw new Error('ID de hotel no disponible');
      return ReservasService.crearReserva({
        ...nuevaReserva,
        hotel_id: hotelId
      });
    },
    onSuccess: (reservaCreada) => {
      queryClient.setQueryData(['reservas', hotelId], (old: Reserva[] | undefined) => {
        if (!old) return [reservaCreada];
        return [reservaCreada, ...old];
      });
      toast.success('Reserva creada exitosamente');
    },
    onError: (err: any) => {
      console.error('Error creando reserva:', err);
      toast.error('No se pudo guardar la reserva');
    }
  });

  // Mutation para actualizar estado de la reserva (Check-In, Check-Out, Cancelar, etc)
  const actualizarEstadoMutation = useMutation({
    mutationFn: ({ reservaId, nuevoEstado }: { reservaId: string; nuevoEstado: Reserva['estado'] }) => {
      return ReservasService.actualizarEstado(reservaId, nuevoEstado);
    },
    onSuccess: (updatedRes) => {
      queryClient.setQueryData(['reservas', hotelId], (old: Reserva[] | undefined) => {
        if (!old) return [updatedRes];
        return old.map(r => r.id === updatedRes.id ? updatedRes : r);
      });
      toast.success(`Estado de reserva actualizado a ${updatedRes.estado}`);
    },
    onError: (err: any) => {
      console.error('Error actualizando estado de reserva:', err);
      toast.error('No se pudo actualizar el estado de la reserva');
    }
  });

  return {
    reservas,
    isLoading,
    isError,
    error,
    refetch,
    crearReserva: (reserva: Omit<Reserva, 'id' | 'hotel_id'>) => 
      crearReservaMutation.mutate(reserva),
    isCreating: crearReservaMutation.isPending,
    actualizarEstado: (reservaId: string, nuevoEstado: Reserva['estado']) => 
      actualizarEstadoMutation.mutate({ reservaId, nuevoEstado }),
    isUpdatingStatus: actualizarEstadoMutation.isPending
  };
}
