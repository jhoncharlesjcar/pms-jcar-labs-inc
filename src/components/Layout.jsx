import { Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect, useMemo, memo } from 'react';
import {
    BedDouble, CalendarDays, Settings,
    ShoppingCart, Users, CreditCard, FileText, Wallet, Package, TrendingUp, Bot, LayoutGrid
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2 } from 'lucide-react';
import GestionHotelesAdmin from '@/components/admin/GestionHotelesAdmin';

import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PageTransition from '@/components/PageTransition';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { useHotelData } from '@/hooks/useHotelData';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import OfflineSyncManager from '@/components/OfflineSyncManager';
import { canAccessPath } from '@/constants/permissions';
import BroomIcon from '@/components/ui/icons/BroomIcon';

import Sidebar from './layout/Sidebar';
import MobileHeader from './layout/MobileHeader';
import MobileNav from './layout/MobileNav';

const navGroups = [
    {
        title: 'RECEPCIÓN Y HABITACIONES',
        items: [
            { path: '/', label: 'Dashboard', icon: LayoutGrid },
            { path: '/recepcion', label: 'Recepción', icon: CalendarDays },
            { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
            { path: '/huespedes', label: 'Huéspedes', icon: Users },
            { path: '/limpieza', label: 'Limpieza', icon: BroomIcon },
        ]
    },
    {
        title: 'FINANZAS E INVENTARIO',
        items: [
            { path: '/ventas', label: 'Ventas y Tickets', icon: CreditCard },
            { path: '/caja', label: 'Caja', icon: Wallet },
            { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
            { path: '/insumos', label: 'Insumos y Suministros', icon: Package },
        ]
    },
    {
        title: 'ANALÍTICA Y CONFIGURACIÓN',
        items: [
            { path: '/revenue', label: 'Revenue & BI', icon: TrendingUp },
            { path: '/jcar-ai', label: 'JCAR AI', icon: Bot },
            { path: '/reportes', label: 'Reportes', icon: FileText },
            { path: '/configuracion', label: 'Configuración', icon: Settings },
        ]
    }
];

const Layout = memo(function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
    const location = useLocation();
    const { user, auth } = useAuth();
    const { hotelId } = useHotelData();
    useRealtimeSync();

    const isDeveloper = user?.role === 'developer';
    const isAdmin = user?.role === 'admin';
    const sidebarCollapsed = isCollapsed && !sidebarOpen;
    const visibleNavGroups = useMemo(() => navGroups
        .map(group => ({
            ...group,
            items: group.items.filter(item => canAccessPath(user?.role, item.path)),
        }))
        .filter(group => group.items.length > 0), [user?.role]);

    // Sidebar collapse shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                setIsCollapsed(prev => {
                    const newVal = !prev;
                    localStorage.setItem('sidebar_collapsed', newVal.toString());
                    return newVal;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Badges query
    const { data: dbStats } = useQuery({
        queryKey: ["dashboardStats", hotelId],
        queryFn: async () => {
            if (!hotelId) return null;
            const { data, error } = await supabase.rpc('get_dashboard_stats', { p_hotel_id: hotelId });
            if (error) return null;
            return data;
        },
        enabled: !!hotelId,
        refetchInterval: 60000
    });

    const getBadge = (path) => {
        if (!dbStats) return 0;
        if (path === '/limpieza') return dbStats.limpieza || 0;
        if (path === '/recepcion') return dbStats.ocupadas_y_pendientes > 0 ? 1 : 0; // Simple indicador
        return 0;
    };

    const [gestionModal, setGestionModal] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

    // Refrescar ScrollTrigger al montar
    useEffect(() => {
        ScrollTrigger.defaults({ scroller: '#main-content' });
        ScrollTrigger.refresh();
        
        return () => {
            ScrollTrigger.defaults({ scroller: "body" }); // Restaurar al desmontar
        }
    }, []);

    // Check theme on mount
    useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
            setIsDark(true);
        } else {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        }
    }, []);

    const toggleTheme = () => {
        const _isDark = !isDark;
        setIsDark(_isDark);
        if (_isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <div className="app-shell flex min-h-screen font-inter">
            <OfflineSyncManager />
            
            <Sidebar 
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                sidebarCollapsed={sidebarCollapsed}
                isCollapsed={isCollapsed}
                visibleNavGroups={visibleNavGroups}
                location={location}
                user={user}
                auth={auth}
                getBadge={getBadge}
                setGestionModal={setGestionModal}
                isDark={isDark}
                toggleTheme={toggleTheme}
                isAdmin={isAdmin}
                isDeveloper={isDeveloper}
            />

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col h-screen transition-all duration-300 overflow-x-hidden",
                isCollapsed ? "lg:ml-[76px]" : "lg:ml-[17rem]"
            )}>
                <MobileHeader sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

                <main id="main-content" className={cn(
                    "app-main custom-scrollbar relative mx-auto w-full max-w-[1740px] flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 lg:pb-10 xl:p-10",
                    location.pathname === '/pos' ? "pb-0" : "pb-24"
                )}>
                    <PageTransition key={location.pathname}>
                        <Outlet />
                    </PageTransition>
                </main>

                <MobileNav user={user} getBadge={getBadge} setSidebarOpen={setSidebarOpen} />
            </div>

            {/* Modal Gestión Hoteles & Staff */}
            <Dialog open={gestionModal} onOpenChange={setGestionModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto glass-panel border-border/80 shadow-xl rounded-xl">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-3 text-2xl">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                                <Building2 className="w-6 h-6 text-blue-500" />
                            </div>
                            Hoteles & Staff
                        </DialogTitle>
                    </DialogHeader>
                    <GestionHotelesAdmin onClose={() => setGestionModal(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
});
Layout.displayName = 'LayoutLegacy';
export default Layout;
