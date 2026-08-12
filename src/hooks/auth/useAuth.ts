import { useAuthStore } from '@/store/auth.store';
import { AuthService } from '@/services/auth.service';
import { useMutation, useQuery } from '@tanstack/react-query';

export function useAuth() {
  const { user, session, hotelId, isAuthenticated, setUser, setSession, clearAuth, setHotelId } = useAuthStore();

  // Mutation para cerrar sesión
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      clearAuth();
      // Limpieza selectiva para no borrar configuraciones (tema, pwa)
      Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
      sessionStorage.clear();
      window.location.replace(window.location.origin);
    }
  });

  return {
    user,
    session,
    hotelId,
    isAuthenticated,
    setUser,
    setSession,
    setHotelId,
    clearAuth,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending
  };
}

// Fallback import de supabase para el signOut
import { supabase } from '@/config/supabase';
