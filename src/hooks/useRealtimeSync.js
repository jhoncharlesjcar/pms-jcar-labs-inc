import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { useHotel } from '@/contexts/HotelContext';
import logger from '@/lib/logger';

export function useRealtimeSync() {
    const queryClient = useQueryClient();
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;

    useEffect(() => {
        if (!hotelId) return;

        logger.debug(`🔌 Suscribiendo a Supabase Realtime (Hotel: ${hotelId})`);

        const channel = supabase.channel(`hotel_${hotelId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'reservas',
                filter: `hotel_id=eq.${hotelId}`
            }, (payload) => {
                logger.debug('🔄 Sincronización Realtime: Reservas', payload);
                queryClient.invalidateQueries({ queryKey: ['reservas', hotelId] });
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'habitaciones',
                filter: `hotel_id=eq.${hotelId}`
            }, (payload) => {
                logger.debug('🔄 Sincronización Realtime: Habitaciones', payload);
                queryClient.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
                queryClient.invalidateQueries({ queryKey: ['habitaciones_sidebar', hotelId] });
            })
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'ventas',
                filter: `hotel_id=eq.${hotelId}`
            }, (payload) => {
                logger.debug('🔄 Sincronización Realtime: Ventas', payload);
                queryClient.invalidateQueries({ queryKey: ['ventas', hotelId] });
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    logger.debug('✅ Realtime Activo');
                }
                if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
                    logger.error(`Realtime no disponible (${status}); refrescando datos como respaldo`);
                    queryClient.invalidateQueries({ queryKey: ['reservas', hotelId] });
                    queryClient.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
                    queryClient.invalidateQueries({ queryKey: ['ventas', hotelId] });
                }
                if (err) {
                    logger.error('❌ Error Realtime:', err);
                }
            });

        return () => {
            logger.debug(`🔌 Desconectando Realtime (Hotel: ${hotelId})`);
            supabase.removeChannel(channel);
        };
    }, [hotelId, queryClient]);
}
