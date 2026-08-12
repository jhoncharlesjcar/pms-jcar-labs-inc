import { useMemo } from 'react';
import { db } from '@/api/db';
import { useAuthStore } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { HotelService } from '@/services/hotel.service';

/**
 * Hook para acceder a datos filtrados por el hotel actual.
 * Evita tener que pasar hotel_id manualmente en cada llamada.
 */
export function useHotelData() {
  const { hotelId, setHotelId } = useAuthStore();

  // Query para obtener todos los hoteles del tenant
  const { data: hoteles = [], isLoading: isLoadingHoteles } = useQuery({
    queryKey: ['hoteles'],
    queryFn: () => HotelService.listHoteles(),
    staleTime: 1000 * 60 * 60, // 1 hora
  });

  const hotelActual = useMemo(() => {
    let actual = hoteles.find(h => h.id === hotelId);
    if (!actual && hoteles.length > 0) {
      // Intentar recuperar del localStorage clásico o default al primero
      const savedId = localStorage.getItem('hotel_activo_id');
      actual = hoteles.find(h => h.id === savedId) || hoteles[0];
      
      // Sincronizar el store si encontramos un fallback válido
      if (actual && hotelId !== actual.id) {
        // Envolver en setTimeout para evitar Warning de actualización de estado en el render
        setTimeout(() => setHotelId(actual.id), 0);
      }
    }
    return actual || null;
  }, [hoteles, hotelId, setHotelId]);

  const hotelDb = useMemo(() => {
    return db.forHotel(hotelId || '');
  }, [hotelId]);

  return {
    db: hotelDb,
    hotelId,
    hotelActual,
    hoteles,
    isLoading: isLoadingHoteles,
    cambiarHotel: (id: string) => setHotelId(id)
  };
}
