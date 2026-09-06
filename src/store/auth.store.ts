import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { UserProfile } from '@/types';

interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  hotelId: string | null;
  isAuthenticated: boolean;
  isOffline: boolean;
  
  // Actions
  setSession: (session: Session | null) => void;
  setUser: (user: UserProfile | null) => void;
  setHotelId: (hotelId: string | null) => void;
  setOffline: (offline: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  hotelId: null,
  isAuthenticated: false,
  isOffline: !navigator.onLine,

  setSession: (session) => set({ 
    session, 
    isAuthenticated: !!session 
  }),
  
  setUser: (user) => set((state) => {
    const updatedHotelId = user?.hotel_id || state.hotelId;
    if (user?.hotel_id) {
      localStorage.setItem('hotel_activo_id', user.hotel_id);
    }
    return { 
      user, 
      hotelId: updatedHotelId 
    };
  }),

  setHotelId: (hotelId) => set(() => {
    if (hotelId) {
      localStorage.setItem('hotel_activo_id', hotelId);
    } else {
      localStorage.removeItem('hotel_activo_id');
    }
    return { hotelId };
  }),

  setOffline: (offline) => set({ isOffline: offline }),

  clearAuth: () => {
    localStorage.removeItem('hotel_activo_id');
    set({
      user: null,
      session: null,
      hotelId: null,
      isAuthenticated: false,
      isOffline: !navigator.onLine
    });
  }
}));
