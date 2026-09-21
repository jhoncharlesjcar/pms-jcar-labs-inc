import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { useHotel } from '@/contexts/HotelContext';

export default function HotelOperationalBanner() {
    const { hotelActual, hoteles, cambiarHotel } = useHotel();
    const hotelId = hotelActual?.id;

    const { data: roomCount, isLoading } = useQuery({
        queryKey: ['habitaciones-count', hotelId],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('habitaciones')
                .select('id', { count: 'exact', head: true })
                .eq('hotel_id', hotelId);
            if (error) throw error;
            return count ?? 0;
        },
        enabled: Boolean(hotelId),
        staleTime: 60_000,
    });

    if (!hotelActual || isLoading || (roomCount ?? 0) > 0) return null;

    const others = hoteles.filter((h) => h.id !== hotelActual.id);
    const nombre = (hotelActual.nombre || 'Este hotel').trim();

    return (
        <div
            role="status"
            className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{nombre} no tiene habitaciones</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Recepción, caja y el tablero de esta propiedad quedan vacíos hasta cargar inventario.
                    </p>
                </div>
            </div>
            {others.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                    {others.map((h) => (
                        <button
                            key={h.id}
                            type="button"
                            onClick={() => cambiarHotel(h.id)}
                            className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                        >
                            Usar {(h.nombre || '').trim()}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
