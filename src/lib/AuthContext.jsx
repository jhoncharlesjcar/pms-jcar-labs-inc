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
            const { data: profile, error } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', authUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // User not found in usuarios table
                setAuthError({ type: 'user_not_registered', message: 'Usuario no registrado' });
                setUser(null);
                return;
            }

            if (error) {
                console.error('Error loading user profile:', error);
                setUser({
                    id: authUser.id,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || '',
                    role: 'recepcionista',
                });
                return;
            }

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
            console.error('Error en loadUserProfile:', err);
            setUser({
                id: authUser.id,
                email: authUser.email,
                full_name: authUser.user_metadata?.full_name || '',
                role: 'recepcionista',
            });
        }
    }, []);

    const checkUserAuth = useCallback(async () => {
        try {
            setIsLoadingAuth(true);
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            if (currentSession?.user) {
                setSession(currentSession);
                await loadUserProfile(currentSession.user);
            } else {
                setSession(null);
                setUser(null);
                setAuthError({ type: 'auth_required', message: 'Autenticación requerida' });
            }
        } catch (err) {
            console.error('Error checking auth:', err);
            setAuthError({ type: 'auth_required', message: 'Error de autenticación' });
        } finally {
            setIsLoadingAuth(false);
            setAuthChecked(true);
        }
    }, [loadUserProfile]);

    useEffect(() => {
        checkUserAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession?.user) {
                setSession(newSession);
                await loadUserProfile(newSession.user);
                setAuthError(null);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                setAuthError({ type: 'auth_required', message: 'Sesión cerrada' });
            } else if (event === 'TOKEN_REFRESHED' && newSession) {
                setSession(newSession);
            }
        });

        return () => subscription?.unsubscribe();
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
