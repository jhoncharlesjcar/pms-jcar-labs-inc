import React, { createContext, useContext } from 'react';
import { useHotelData } from '@/hooks/useHotelData';

const HotelContext = createContext<any>(null);

export const HotelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { hotelActual, hoteles, cambiarHotel, isLoading } = useHotelData();

  const value = {
    hotelActual,
    hoteles,
    loading: isLoading,
    cambiarHotel
  };

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
};

export const useHotel = () => {
  const context = useContext(HotelContext);
  if (!context) {
    // Fallback directo a useHotelData si se usa fuera del Provider
    try {
      const { hotelActual, hoteles, cambiarHotel, isLoading } = useHotelData();
      return {
        hotelActual,
        hoteles,
        loading: isLoading,
        cambiarHotel
      };
    } catch {
      return {
        hotelActual: null,
        hoteles: [],
        loading: false,
        cambiarHotel: () => {}
      };
    }
  }
  return context;
};
