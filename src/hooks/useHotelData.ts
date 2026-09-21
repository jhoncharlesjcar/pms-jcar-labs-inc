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
  const { hotelId, setHotelId, user } = useAuthStore();

  const { data: hoteles = [], isLoading: isLoadingHoteles } = useQuery({
    queryKey: ['hoteles'],
    queryFn: () => HotelService.listHoteles(),
    staleTime: 1000 * 60 * 5,
  });

  const resolvedHotelId = hotelId || user?.hotel_id || null;

  const hotelActual = useMemo(() => {
    if (!hoteles.length) return null;
    const preferredId = hotelId || user?.hotel_id || localStorage.getItem('hotel_activo_id');
    let actual = hoteles.find(h => h.id === preferredId);
    if (!actual) {
      actual = hoteles[0];
      if (actual && hotelId !== actual.id) {
        setTimeout(() => setHotelId(actual.id), 0);
      }
    }
    return actual || null;
  }, [hoteles, hotelId, user?.hotel_id, setHotelId]);

  const hotelDb = useMemo(() => {
    return db.forHotel(resolvedHotelId || hotelActual?.id || '');
  }, [resolvedHotelId, hotelActual?.id]);

  return {
    db: hotelDb,
    hotelId: resolvedHotelId || hotelActual?.id || null,
    hotelActual,
    hoteles,
    isLoading: isLoadingHoteles,
    cambiarHotel: (id: string) => setHotelId(id)
  };
}
