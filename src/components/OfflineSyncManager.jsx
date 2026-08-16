import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useHotel } from '@/contexts/HotelContext';
import { processQueue } from '@/lib/sync-queue';
import logger from '@/lib/logger';

export default function OfflineSyncManager() {
    const { user } = useAuth();
    const { hotelActual } = useHotel();
    const userId = user?.id;
    const hotelId = hotelActual?.id;

    useEffect(() => {
        if (!userId || !hotelId) return;

        let running = false;
        const sync = async () => {
            if (running || !navigator.onLine) return;
            running = true;
            try {
                await processQueue(userId, hotelId);
            } catch (error) {
                logger.error('[OFFLINE] No se pudo procesar la cola:', error);
            } finally {
                running = false;
            }
        };

        window.addEventListener('connection_restored', sync);
        void sync();
        return () => window.removeEventListener('connection_restored', sync);
    }, [userId, hotelId]);

    return null;
}
