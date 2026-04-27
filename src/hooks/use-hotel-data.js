import { useMemo } from 'react';
import { db } from '@/api/db';
import { useHotel } from '@/lib/HotelContext';

/**
 * Hook profesional para acceder a datos filtrados por el hotel actual.
 * Evita tener que pasar hotel_id manualmente en cada llamada.
 */
export function useHotelData() {
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;

    const hotelDb = useMemo(() => {
        return db.forHotel(hotelId);
    }, [hotelId]);

    return {
        db: hotelDb,
        hotelId,
        hotelActual
    };
}
