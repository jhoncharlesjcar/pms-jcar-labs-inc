import React, { useState, useEffect } from 'react';
import { Toaster } from "@/components/ui/sonner"
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClientInstance, idbPersister } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { HotelProvider, useHotel } from '@/lib/HotelContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import ProtectedRoute from '@/router/ProtectedRoute';
import SkipNavLink from '@/components/common/SkipNavLink';
import GSAPProvider from '@/components/GSAPProvider';
import PageSkeleton from '@/components/loaders/PageSkeleton';

function ConnectionBanner() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-1.5 z-[9999] flex items-center justify-center gap-2 shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            Estás navegando en modo sin conexión.
        </div>
    );
}

// Lazy loading de páginas
const Dashboard = React.lazy(() => import('@/pages/Dashboard'));
const Habitaciones = React.lazy(() => import('@/pages/Habitaciones'));
const Recepcion = React.lazy(() => import('@/pages/Recepcion'));
const Ventas = React.lazy(() => import('@/pages/Ventas'));
const Caja = React.lazy(() => import('@/pages/Caja'));
const Reportes = React.lazy(() => import('@/pages/Reportes'));
const Revenue = React.lazy(() => import('@/pages/Revenue'));
const Configuracion = React.lazy(() => import('@/pages/Configuracion'));
const PuntoVenta = React.lazy(() => import('@/pages/PuntoVenta'));
const Huespedes = React.lazy(() => import('@/pages/Huespedes'));
const PanelDesarrollador = React.lazy(() => import('@/pages/PanelDesarrollador'));
const Limpieza = React.lazy(() => import('@/pages/Limpieza'));
const InsumosPage = React.lazy(() => import('@/pages/InsumosPage'));
const PortalHuesped = React.lazy(() => import('@/pages/PortalHuesped'));
const BookingPublico = React.lazy(() => import('@/pages/BookingPublico'));
const CheckinPublico = React.lazy(() => import('@/pages/CheckinPublico'));

const AuthenticatedApp = () => {
    const { user, isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();
    const { loading: isLoadingHotel } = useHotel();


    const isActualLoading = isLoadingPublicSettings || isLoadingAuth || isLoadingHotel;

    if (isActualLoading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-6 max-w-md w-full px-8">
                    <div className="w-full space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            </div>
                        </div>
                        <div className="skeleton h-4 w-48 mx-auto rounded-md" />
                        <div className="skeleton h-3 w-64 mx-auto rounded-md" />
                        <div className="skeleton h-10 w-full rounded-xl mt-6" />
                        <div className="skeleton h-10 w-full rounded-xl" />
                        <div className="skeleton h-32 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (authError && authError.type === 'user_not_registered') {
        return <UserNotRegisteredError />;
    }

    return (
        <ErrorBoundary>
            <React.Suspense fallback={
                <div className="p-4 sm:p-6 lg:p-10">
                    <PageSkeleton variant="dashboard" />
                </div>
            }>
                <Routes>
                    {/* Rutas públicas */}
                    <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
                    <Route path="/booking/:hotelId?" element={<BookingPublico />} />
                    <Route path="/public-checkin/:hotelId?" element={<CheckinPublico />} />
                    <Route path="/portal/:reservaId" element={<PortalHuesped />} />

                    {/* Rutas protegidas */}
                    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/habitaciones" element={<Habitaciones />} />
                        <Route path="/recepcion" element={<Recepcion />} />
                        <Route path="/huespedes" element={<Huespedes />} />
                        <Route path="/ventas" element={<Ventas />} />
                        <Route path="/caja" element={<Caja />} />
                        <Route path="/reportes" element={<Reportes />} />
                        <Route path="/revenue" element={<Revenue />} />
                        <Route path="/configuracion" element={<Configuracion />} />
                        <Route path="/pos" element={<PuntoVenta />} />
                        <Route path="/limpieza" element={<Limpieza />} />
                        <Route path="/insumos" element={<InsumosPage />} />
                        <Route path="/dev" element={<PanelDesarrollador />} />
                    </Route>
                    <Route path="*" element={<PageNotFound />} />
                </Routes>
            </React.Suspense>
        </ErrorBoundary>
    );
};



function App() {
    return (
        <PersistQueryClientProvider client={queryClientInstance} persistOptions={{ persister: idbPersister }}>
            <AuthProvider>
                <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                    <SkipNavLink />                        <HotelProvider>
                            <GSAPProvider>
                                <AuthenticatedApp />
                            </GSAPProvider>
                        </HotelProvider>
                    <Toaster />
                    <ConnectionBanner />
                </Router>
            </AuthProvider>
        </PersistQueryClientProvider>
    )
}

export default App