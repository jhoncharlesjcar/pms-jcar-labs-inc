import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HabitacionesService } from '@/services/habitaciones.service';
import { Habitacion } from '@/types';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';

export function useHabitaciones() {
  const queryClient = useQueryClient();
  const { hotelId } = useAuthStore();

  // Query para obtener habitaciones
  const {
    data: habitaciones = [],
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ['habitaciones', hotelId],
    queryFn: () => {
      if (!hotelId) return [];
      return HabitacionesService.getHabitacionesByHotel(hotelId);
    },
    enabled: !!hotelId,
    staleTime: 30000, // 30 segundos (cambian con relativa frecuencia)
    gcTime: 1000 * 60 * 5 // 5 minutos de garbage collection cache
  });

  // Mutation para cambiar el estado de una habitación (e.g. libre, limpieza, mantenimento)
  const cambiarEstadoMutation = useMutation({
    mutationFn: ({ habitacionId, nuevoEstado }: { habitacionId: string; nuevoEstado: Habitacion['estado'] }) => {
      return HabitacionesService.actualizarEstado(habitacionId, nuevoEstado);
    },
    onSuccess: (updatedHab) => {
      queryClient.setQueryData(['habitaciones', hotelId], (old: Habitacion[] | undefined) => {
        if (!old) return [updatedHab];
        return old.map(h => h.id === updatedHab.id ? updatedHab : h);
      });
      toast.success(`Habitación ${updatedHab.numero} actualizada a ${updatedHab.estado}`);
    },
    onError: (err: any) => {
      console.error('Error actualizando estado de habitación:', err);
      toast.error('No se pudo actualizar el estado de la habitación');
    }
  });

  return {
    habitaciones,
    isLoading,
    isError,
    error,
    refetch,
    cambiarEstado: (habitacionId: string, nuevoEstado: Habitacion['estado']) => 
      cambiarEstadoMutation.mutate({ habitacionId, nuevoEstado }),
    isUpdatingState: cambiarEstadoMutation.isPending
  };
}
