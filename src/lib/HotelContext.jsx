import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

const HotelContext = createContext(null);

export function HotelProvider({ children }) {
    const { user } = useAuth();
    const [hotelActual, setHotelActual] = useState(null);
    const [hoteles, setHoteles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const cargarHoteles = async () => {
            if (!user) {
                setHoteles([]);
                setHotelActual(null);
                setLoading(false);
                return;
            }

            try {
                const { data, error } = await supabase
                    .from('hoteles')
                    .select('*')
                    .eq('activo', true)
                    .order('nombre');

                if (error) {
                    console.error('Error loading hotels:', error);
                    setHoteles([]);
                    setHotelActual(null);
                    setLoading(false);
                    return;
                }

                setHoteles(data || []);

                // Si el usuario tiene un hotel_id asignado, usarlo
                if (user.hotel_id) {
                    const hotelAsignado = data?.find(h => h.id === user.hotel_id);
                    if (hotelAsignado) {
                        setHotelActual(hotelAsignado);
                    } else if (data?.length > 0) {
                        setHotelActual(data[0]);
                    }
                } else if (data?.length > 0) {
                    // Intentar recuperar del localStorage
                    const savedId = localStorage.getItem('hotel_activo_id');
                    const saved = savedId ? data.find(h => h.id === savedId) : null;
                    setHotelActual(saved || data[0]);
                }
            } catch (err) {
                console.error('Error en cargarHoteles:', err);
                setHoteles([]);
            } finally {
                setLoading(false);
            }
        };

        cargarHoteles();
    }, [user]);

    const cambiarHotel = (hotel) => {
        setHotelActual(hotel);
        localStorage.setItem('hotel_activo_id', hotel.id);
    };

    const value = {
        hotelActual,
        hoteles,
        loading,
        cambiarHotel,
    };

    return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
    const context = useContext(HotelContext);
    if (!context) {
        throw new Error('useHotel must be used within a HotelProvider');
    }
    return context;
}
