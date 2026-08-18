import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { useAuthStore } from '@/store/auth.store';
import { getDeadLetterCount, getPendingCount, processQueue, purgeQueuesForIdentity } from '@/lib/sync-queue';
import { idbPersister, queryClientInstance } from '@/lib/query-client';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  user: UserProfile | null;
  session: any | null;
  hotelId: string | null;
  isAuthenticated: boolean;
  isOffline: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: { type: string; message: string } | null;
  authChecked: boolean;
  navigateToLogin: () => Promise<void>;
  auth: { logout: () => Promise<void> };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: storeUser, session: storeSession, hotelId, clearAuth, setOffline, setUser: setStoreUser, setSession: setStoreSession } = useAuthStore();

  // Estado local para loading / errores (no persistente)
  const [user, setUser] = useState<UserProfile | null>(storeUser);
  const [session, setSession] = useState<any>(storeSession);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState<{ type: string; message: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Detectar cambios en la conectividad (RN-AUTH-002)
  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); setOffline(false); };
    const handleOffline = () => { setIsOffline(true); setOffline(true); };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOffline(!navigator.onLine);
    setOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOffline]);

  const loadUserProfile = useCallback(async (authUser: any) => {
    if (!authUser) {
      setUser(null);
      setStoreUser(null);
      return;
    }

    try {
      logger.debug('[DB] Consultando tabla usuarios para ID:', authUser.id);
      const { data: profile, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code === 'PGRST116') {
        logger.warn('[DB] Perfil no encontrado en usuarios (PGRST116)');
        setAuthError({ type: 'user_not_registered', message: 'Usuario no registrado' });
        setUser(null);
        setStoreUser(null);
        return;
      }

      if (error) {
        logger.error('[DB] Error en consulta de perfil:', error);
        setAuthError({ type: 'profile_unavailable', message: 'No se pudo validar tu perfil. Intenta nuevamente con conexión.' });
        setUser(null);
        setStoreUser(null);
        return;
      }

      // Hallazgo #8: Verificar que el usuario está activo
      if (profile.activo === false) {
        logger.warn('[AUTH] Usuario desactivado, forzando cierre de sesión:', profile.id);
        setAuthError({ type: 'user_deactivated', message: 'Tu cuenta ha sido desactivada. Contacta al administrador.' });
        await supabase.auth.signOut();
        setUser(null);
        setStoreUser(null);
        return;
      }

      logger.debug('[DB] Perfil cargado con éxito:', profile.full_name);
      const allowedRoles = ['admin', 'developer', 'recepcionista', 'limpieza'];
      if (!allowedRoles.includes(profile.role)) {
        logger.error('[AUTH] Perfil con rol inválido:', profile.role);
        setAuthError({ type: 'invalid_role', message: 'Tu perfil no tiene un rol válido. Contacta al administrador.' });
        setUser(null);
        setStoreUser(null);
        return;
      }
      const profileData: UserProfile = {
        id: profile.id,
        email: profile.email || authUser.email,
        full_name: profile.full_name || authUser.user_metadata?.full_name || '',
        role: profile.role,
        hotel_id: profile.hotel_id,
        ...profile,
      };
      setUser(profileData);
      setStoreUser(profileData);
      setAuthError(null);
    } catch (err) {
      logger.error('[DB] Error crítico en loadUserProfile:', err);
      setAuthError({ type: 'profile_unavailable', message: 'No se pudo validar tu perfil. Acceso denegado por seguridad.' });
      setUser(null);
      setStoreUser(null);
    }
  }, []);

  // checkUserAuth eliminado porque supabase.auth.onAuthStateChange 
  // lanza INITIAL_SESSION inmediatamente al montarse garantizando la carga.

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      logger.debug(`[AUTH] Event: ${event}`, !!newSession);

      if (newSession?.user) {
        setSession(newSession);
        setStoreSession(newSession);
        setAuthError(null);

        // El acceso permanece cerrado hasta validar perfil, rol y estado activo,
        // pero evitamos unmount de toda la app si ya teníamos un usuario en memoria
        // (ej: cuando Supabase emite SIGNED_IN por un refresco de token en background)
        const isInitialLoad = !storeUser;
        if (isInitialLoad) {
          setIsLoadingAuth(true);
        }
        await loadUserProfile(newSession.user);
        if (isMounted) setIsLoadingAuth(false);
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
        setSession(null);
        setStoreSession(null);
        setUser(null);
        setStoreUser(null);
        setAuthError({ type: 'auth_required', message: 'Sesión requerida' });
        queryClientInstance.clear();
        await idbPersister.removeClient();
        setIsLoadingAuth(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [loadUserProfile]);

  const navigateToLogin = useCallback(async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (err) {
      logger.error('Error initiating Google login:', err);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    hotelId,
    isAuthenticated: !!user && !!session,
    isOffline,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    authChecked,
    navigateToLogin,
    auth: {
      logout: async () => {
        const currentUserId = user?.id;
        const currentHotelId = localStorage.getItem('hotel_activo_id');

        if (currentUserId && currentHotelId) {
          let pending = await getPendingCount(currentUserId, currentHotelId);
          if (pending > 0 && navigator.onLine) {
            await processQueue(currentUserId, currentHotelId);
            pending = await getPendingCount(currentUserId, currentHotelId);
          }
          if (pending > 0) {
            window.alert(`No se puede cerrar sesión: quedan ${pending} cambios locales sin sincronizar. Conéctate y vuelve a intentarlo.`);
            return;
          }
          const deadLetters = await getDeadLetterCount(currentUserId, currentHotelId);
          if (deadLetters > 0) {
            const proceed = window.confirm(`Hay ${deadLetters} cambio(s) fallidos que no se pudieron sincronizar. Si cierras sesión ahora se perderán. ¿Deseas salir de todos modos?`);
            if (!proceed) return;
          }
        }

        try {
          const { error } = await supabase.auth.signOut();
          if (error) logger.error('Error Supabase signOut:', error);
        } catch (err) {
          logger.error('Error crítico en logout:', err);
        }
        clearAuth();

        // Hallazgo #9: Purgar TODAS las caches y colas offline
        try {
          // Purgar colas de sincronización offline (particionadas por user+hotel)
          if (currentUserId && currentHotelId) await purgeQueuesForIdentity(currentUserId, currentHotelId);
          logger.debug('[LOGOUT] Colas offline purgadas');

          // Purgar únicamente el persister de React Query; no borrar IndexedDB completo.
          queryClientInstance.clear();
          await idbPersister.removeClient();
          logger.debug('[LOGOUT] Query cache persistida purgada');
        } catch (purgeErr) {
          logger.error('[LOGOUT] Error purgando caches:', purgeErr);
        }

        // Limpieza selectiva para no borrar configuraciones (tema, pwa)
        Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
        sessionStorage.clear();
        window.location.replace(window.location.origin);
      },
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
