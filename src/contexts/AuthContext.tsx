import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';
import { useAuthStore } from '@/store/auth.store';
import type { UserProfile } from '@/types';

interface AuthContextValue {
  user: UserProfile | null;
  session: any | null;
  isAuthenticated: boolean;
  isOffline: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authError: { type: string; message: string } | null;
  authChecked: boolean;
  navigateToLogin: () => Promise<void>;
  checkUserAuth: () => Promise<void>;
  auth: { logout: () => Promise<void> };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: storeUser, session: storeSession, isAuthenticated, clearAuth, setOffline, setUser: setStoreUser, setSession: setStoreSession } = useAuthStore();

  // Estado local para loading / errores (no persistente)
  const [user, setUser] = useState<UserProfile | null>(storeUser);
  const [session, setSession] = useState<any>(storeSession);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
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
        const fallbackUser = {
          id: authUser.id,
          email: authUser.email,
          full_name: authUser.user_metadata?.full_name || '',
          role: 'recepcionista',
        } as UserProfile;
        setUser(fallbackUser);
        setStoreUser(fallbackUser);
        return;
      }

      logger.debug('[DB] Perfil cargado con éxito:', profile.full_name);
      const profileData: UserProfile = {
        id: profile.id,
        email: profile.email || authUser.email,
        full_name: profile.full_name || authUser.user_metadata?.full_name || '',
        role: profile.role || 'recepcionista',
        hotel_id: profile.hotel_id,
        ...profile,
      };
      setUser(profileData);
      setStoreUser(profileData);
      setAuthError(null);
    } catch (err) {
      logger.error('[DB] Error crítico en loadUserProfile:', err);
      const fallbackUser = {
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.user_metadata?.full_name || '',
        role: 'recepcionista',
      } as UserProfile;
      setUser(fallbackUser);
      setStoreUser(fallbackUser);
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession?.user) {
        setSession(currentSession);
        setStoreSession(currentSession);
        await loadUserProfile(currentSession.user);
      }
    } catch (err) {
      logger.error('Error in checkUserAuth:', err);
    } finally {
      setAuthChecked(true);
    }
  }, [loadUserProfile]);

  useEffect(() => {
    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;
      logger.debug(`[AUTH] Event: ${event}`, !!newSession);

      if (newSession?.user) {
        setSession(newSession);
        setStoreSession(newSession);
        setAuthError(null);

        // LIBERAMOS EL LOADING DE INMEDIATO PARA QUE LA APP SE MUESTRE
        setIsLoadingAuth(false);

        // Cargamos el perfil en "segundo plano" para no bloquear la UI
        logger.debug('[AUTH] Cargando perfil en segundo plano...');
        loadUserProfile(newSession.user).then(() => {
          logger.debug('[AUTH] Perfil sincronizado.');
        });
      } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
        setSession(null);
        setStoreSession(null);
        setUser(null);
        setStoreUser(null);
        setAuthError({ type: 'auth_required', message: 'Sesión requerida' });
        setIsLoadingAuth(false);
      }
    });

    checkUserAuth();

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [checkUserAuth, loadUserProfile]);

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
    isAuthenticated: !!user && !!session,
    isOffline,
    isLoadingAuth,
    isLoadingPublicSettings,
    authError,
    authChecked,
    navigateToLogin,
    checkUserAuth,
    auth: {
      logout: async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (error) logger.error('Error Supabase signOut:', error);
        } catch (err) {
          logger.error('Error crítico en logout:', err);
        }
        clearAuth();
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
    // Fallback: si no hay provider, leer directamente de Zustand
    const store = useAuthStore.getState();
    return {
      user: store.user,
      session: store.session,
      isAuthenticated: store.isAuthenticated,
      isOffline: store.isOffline,
      isLoadingAuth: false,
      isLoadingPublicSettings: false,
      authError: null,
      authChecked: true,
      navigateToLogin: async () => {},
      checkUserAuth: async () => {},
      auth: {
        logout: async () => {
          store.clearAuth();
          Object.keys(localStorage).forEach(k => k.startsWith('sb-') && localStorage.removeItem(k));
          sessionStorage.clear();
          window.location.replace(window.location.origin);
        },
      },
    };
  }
  return context;
};
