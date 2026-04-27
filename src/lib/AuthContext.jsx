import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
    const [authError, setAuthError] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);

    const loadUserProfile = useCallback(async (authUser) => {
        if (!authUser) {
            setUser(null);
            return;
        }

        try {
            console.log('[DB] Consultando tabla usuarios para ID:', authUser.id);
            const { data: profile, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                console.warn('[DB] Perfil no encontrado en usuarios (PGRST116)');
                setAuthError({ type: 'user_not_registered', message: 'Usuario no registrado' });
                setUser(null);
                return;
            }

            if (error) {
                console.error('[DB] Error en consulta de perfil:', error);
                setUser({
                    id: authUser.id,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || '',
                    role: 'recepcionista',
                });
                return;
            }

            console.log('[DB] Perfil cargado con éxito:', profile.full_name);
            setUser({
                id: profile.id,
                email: profile.email || authUser.email,
                full_name: profile.full_name || authUser.user_metadata?.full_name || '',
                role: profile.role || 'recepcionista',
                hotel_id: profile.hotel_id,
                ...profile,
            });
            setAuthError(null);
        } catch (err) {
            console.error('[DB] Error crítico en loadUserProfile:', err);
            setUser({
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || '',
                role: 'recepcionista',
            });
        }
    }, []);

    const checkUserAuth = useCallback(async () => {
        // Esta función ahora solo hace un chequeo preventivo, 
        // pero onAuthStateChange es quien manda.
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.user) {
                setSession(currentSession);
                await loadUserProfile(currentSession.user);
            }
        } catch (err) {
            console.error('Error in checkUserAuth:', err);
        } finally {
            // No quitamos el loading aquí, dejamos que el evento settling del auth lo haga
            setAuthChecked(true);
        }
    }, [loadUserProfile]);

    useEffect(() => {
        let isMounted = true;
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (!isMounted) return;
            console.log(`[AUTH] Event: ${event}`, !!newSession);
            
            if (newSession?.user) {
                setSession(newSession);
                setAuthError(null);
                
                // LIBERAMOS EL LOADING DE INMEDIATO PARA QUE LA APP SE MUESTRE
                setIsLoadingAuth(false);
                
                // Cargamos el perfil en "segundo plano" para no bloquear la UI
                console.log('[AUTH] Cargando perfil en segundo plano...');
                loadUserProfile(newSession.user).then(() => {
                    console.log('[AUTH] Perfil sincronizado.');
                });
            } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !newSession)) {
                setSession(null);
                setUser(null);
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
        // Usar signInWithOAuth de Supabase para Google
        try {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin,
                },
            });
        } catch (err) {
            console.error('Error initiating Google login:', err);
        }
    }, []);

    const isAuthenticated = !!user && !!session;

    const value = {
        user,
        session,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        authChecked,
        navigateToLogin,
        checkUserAuth,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
