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
import Dashboard from '@/pages/Dashboard';
import Habitaciones from '@/pages/Habitaciones';
import Recepcion from '@/pages/Recepcion';
import Ventas from '@/pages/Ventas';
import Configuracion from '@/pages/Configuracion';
import Documentacion from '@/pages/Documentacion';
import PuntoVenta from '@/pages/PuntoVenta';
import PanelDesarrollador from '@/pages/PanelDesarrollador';

const AuthenticatedApp = () => {
    const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

    if (isLoadingPublicSettings || isLoadingAuth) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-sm text-muted-foreground font-medium">Cargando HospedajePRO...</p>
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
        <Routes>
            <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/habitaciones" element={<Habitaciones />} />
                <Route path="/recepcion" element={<Recepcion />} />
                <Route path="/ventas" element={<Ventas />} />
                <Route path="/configuracion" element={<Configuracion />} />
                <Route path="/documentacion" element={<Documentacion />} />
                <Route path="/pos" element={<PuntoVenta />} />
                <Route path="/dev" element={<PanelDesarrollador />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
        </Routes>
    );
};

function App() {
    return (
        <QueryClientProvider client={queryClientInstance}>
            <AuthProvider>
                <Router>
                    <HotelProvider>
                        <AuthenticatedApp />
                    </HotelProvider>
                    <Toaster />
                </Router>
            </AuthProvider>
        </QueryClientProvider>
    )
}

export default App