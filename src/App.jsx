import React from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { HotelProvider } from '@/lib/HotelContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';

// Lazy loading de páginas
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Habitaciones = React.lazy(() => import('@/pages/Habitaciones'));
const Recepcion = React.lazy(() => import('@/pages/Recepcion'));
const Ventas = React.lazy(() => import('@/pages/Ventas'));
const Configuracion = React.lazy(() => import('@/pages/Configuracion'));
const PuntoVenta = React.lazy(() => import('@/pages/PuntoVenta'));
const PanelDesarrollador = React.lazy(() => import('@/pages/PanelDesarrollador'));

const AuthenticatedApp = () => {
    const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

    if (isLoadingPublicSettings || isLoadingAuth) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-sm text-muted-foreground font-medium">Cargando HOSPEDAJE ANGELICA FREY...</p>
                </div>
            </div>
        );
    }

    if (authError) {
        if (authError.type === 'user_not_registered') {
            return <UserNotRegisteredError />;
        } else if (authError.type === 'auth_required') {
            return <Login />;
        }
    }

    return (
        <React.Suspense fallback={
            <div className="fixed inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        }>
            <Routes>
                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/habitaciones" element={<Habitaciones />} />
                    <Route path="/recepcion" element={<Recepcion />} />
                    <Route path="/ventas" element={<Ventas />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/pos" element={<PuntoVenta />} />
                    <Route path="/dev" element={<PanelDesarrollador />} />
                </Route>
                <Route path="*" element={<PageNotFound />} />
            </Routes>
        </React.Suspense>
    );
};

import RegisterSW from '@/components/RegisterSW';

function App() {
    return (
        <QueryClientProvider client={queryClientInstance}>
            <AuthProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <HotelProvider>
                        <AuthenticatedApp />
                    </HotelProvider>
                    <RegisterSW />
                    <Toaster />
                </Router>
            </AuthProvider>
        </QueryClientProvider>
    )
}

export default App