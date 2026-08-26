import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { supabase } from '@/config/supabase';

export async function invokeBooking(body) {
    const { data, error } = await supabase.functions.invoke('public-booking', { body });
    if (error) throw new Error('El motor de reservas seguro no está disponible. Contacta al hotel.');
    if (!data || data.error) throw new Error(data?.error || 'No se pudo completar la solicitud.');
    return data;
}

export function useBookingData() {
    const { hotelId } = useParams();
    const [dates, setDates] = useState({
        fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
        fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    });
    const [guest, setGuest] = useState({ 
        tipo_reserva: 'particular', 
        nombre: '', 
        documento: '', 
        tipo_documento: 'DNI',
        telefono: '', 
        email: '' 
    });
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [completed, setCompleted] = useState(null);
    const [challengeToken, setChallengeToken] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('yape');
    const turnstileRef = useRef(null);
    const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const sessionId = useMemo(() => {
        const key = `jcar_booking_session:${hotelId}`;
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const generated = crypto.randomUUID();
        sessionStorage.setItem(key, generated);
        return generated;
    }, [hotelId]);
    const idempotencyKey = useMemo(() => {
        const key = `jcar_booking_idempotency:${hotelId}`;
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const generated = crypto.randomUUID();
        sessionStorage.setItem(key, generated);
        return generated;
    }, [hotelId]);

    const configQuery = useQuery({
        queryKey: ['hotel-config-public', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase.from('hoteles').select('nombre, logo_url, qr_yape_url, qr_plin_url').eq('id', hotelId).single();
            if (error) throw new Error('Enlace de reserva inválido o hotel no encontrado.');
            return data;
        },
        enabled: !!hotelId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hotelId),
        retry: false,
    });


    return {
        hotelId, configQuery, config: configQuery.data,
        dates, setDates,
        guest, setGuest,
        options, setOptions,
        selected, setSelected,
        completed, setCompleted,
        challengeToken, setChallengeToken,
        paymentMethod, setPaymentMethod,
        turnstileRef, turnstileSiteKey,
        sessionId, idempotencyKey
    };
}
