import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, memo } from 'react';
import {
    BedDouble, CalendarDays, Settings,
    Menu, X, Hotel, LogOut, ShoppingCart, Code2, Building2,
    LayoutGrid, Users, CreditCard, FileText, Wallet, Sun, Moon, Package, TrendingUp
} from 'lucide-react';

import { db } from '@/api/db';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import SelectorHotel from '@/components/SelectorHotel';
import { GlobalCommand } from '@/components/GlobalCommand';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GestionHotelesAdmin from '@/components/admin/GestionHotelesAdmin';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PageTransition from '@/components/PageTransition';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/config/supabase';
import { useHotelData } from '@/hooks/use-hotel-data';

// ScrollTrigger debe usar #main-content como contenedor de scroll
import BroomIcon from '@/components/ui/icons/BroomIcon';

// (El scroller por defecto se configura dinámicamente dentro de Layout)

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
            { path: '/reportes', label: 'Reportes', icon: FileText },
            { path: '/configuracion', label: 'Configuración', icon: Settings },
        ]
    }
];

const ROLE_LABELS = {
    admin: { label: 'Admin', color: 'text-primary' },
    recepcionista: { label: 'Recepción', color: 'text-emerald-500' },
    developer: { label: 'Dev', color: 'text-amber-500' },
    user: { label: 'Usuario', color: 'text-muted-foreground' },
};

const Layout = memo(function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
    const location = useLocation();
    const { user } = useAuth();
    const { hotelId } = useHotelData();

    const isDeveloper = user?.role === 'developer';
    const isAdmin = user?.role === 'admin';
    const navRef = useRef(null);
    const sidebarTweenRef = useRef(null);

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

    // GSAP stagger en items de navegación al montar la app
    useEffect(() => {
        if (!navRef.current) return;
        const items = navRef.current.querySelectorAll(':scope > div > a, :scope > div > button');
        if (items.length === 0) return;

        if (sidebarTweenRef.current) sidebarTweenRef.current.kill();

        const tween = gsap.fromTo(
            items,
            { opacity: 0, x: -10 },
            {
                opacity: 1,
                x: 0,
                duration: 0.35,
                ease: 'power2.out',
                stagger: {
                    each: 0.04,
                    from: 'start',
                },
                delay: 0.1,
            }
        );

        sidebarTweenRef.current = tween;
        return () => { if (sidebarTweenRef.current) { sidebarTweenRef.current.kill(); sidebarTweenRef.current = null; } };
    }, [isCollapsed]);

    const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS['user'];
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
        <div className="min-h-screen bg-background flex font-inter">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar (Enterprise SaaS) */}
            <aside className={cn(
                "fixed top-0 left-0 h-screen bg-card border-r border-border z-50 flex flex-col transition-all duration-300 ease-in-out shadow-sm",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                isCollapsed ? "w-64 lg:w-[72px]" : "w-64"
            )}>
                {/* Header Marca & Logo */}
                <div className={cn("p-5 border-b border-border/50 flex items-center gap-3 transition-all duration-300", isCollapsed ? "justify-center px-2" : "")}>
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-xs flex-shrink-0" title="PMS JCAR LABS">
                        <Hotel className="w-4.5 h-4.5 text-primary-foreground" />
                    </div>
                    {!isCollapsed && (
                        <div className="min-w-0 flex-1 opacity-100 transition-opacity duration-300 delay-100">
                            <p className="font-display font-bold text-[15px] text-foreground leading-none tracking-tight truncate">PMS JCAR LABS</p>
                        </div>
                    )}
                </div>

                {/* Selector de Hotel */}
                {!isDeveloper && !isCollapsed && (
                    <div className="px-3 pt-3 animate-in fade-in zoom-in duration-300">
                        <SelectorHotel />
                    </div>
                )}

                {/* Búsqueda Global */}
                {!isCollapsed && (
                    <div className="px-3 pt-2 animate-in fade-in duration-300">
                        <GlobalCommand />
                    </div>
                )}

                {/* Navegación Principal Estructurada */}
                <nav ref={navRef} className={cn("flex-1 pt-3 space-y-4 overflow-y-auto custom-scrollbar", isCollapsed ? "px-2" : "px-3")}>
                    {navGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            {!isCollapsed ? (
                                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest px-3 mb-1.5 select-none animate-in fade-in">
                                    {group.title}
                                </p>
                            ) : (
                                <div className="h-px bg-border/40 mx-2 mb-2 mt-4 first:mt-0" />
                            )}
                            {group.items.map(({ path, label, icon: Icon }) => {
                                const active = location.pathname === path;
                                const badge = getBadge(path);
                                return (
                                    <Link
                                        key={path}
                                        to={path}
                                        onClick={() => setSidebarOpen(false)}
                                        title={isCollapsed ? label : undefined}
                                        className={cn(
                                            "flex items-center rounded-lg text-sm font-medium transition-colors group relative",
                                            isCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                                            active
                                                ? "bg-primary/10 text-primary font-semibold"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        {active && !isCollapsed && (
                                            <span className="w-1 h-5 rounded-full bg-primary absolute left-0 shadow-sm" />
                                        )}
                                        {active && isCollapsed && (
                                            <span className="w-1 h-5 rounded-full bg-primary absolute left-0 shadow-sm rounded-l-none" />
                                        )}
                                        <div className="relative flex-shrink-0">
                                            <Icon className={cn("w-4.5 h-4.5 transition-transform group-hover:scale-110", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                            {badge > 0 && isCollapsed && (
                                                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card" />
                                            )}
                                        </div>
                                        {!isCollapsed && (
                                            <>
                                                <span className="flex-1 truncate animate-in fade-in duration-300">{label}</span>
                                                {badge > 0 && (
                                                    <span className="ml-auto px-1.5 py-0.5 text-[9px] font-black bg-destructive text-destructive-foreground rounded-full min-w-[18px] text-center shadow-xs animate-in fade-in zoom-in">
                                                        {badge}
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>
                    ))}

                    {/* Admin / Dev Section */}
                    {(isAdmin || isDeveloper) && (
                        <div className="pt-3 pb-1">
                            <div className="h-px bg-border/40 mx-2 mb-2" />
                            {isAdmin && (
                                <button
                                    onClick={() => { setGestionModal(true); setSidebarOpen(false); }}
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 w-full transition-colors"
                                >
                                    <Building2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                    <span className="flex-1 text-left truncate">Hoteles & Staff</span>
                                </button>
                            )}
                            {isDeveloper && (
                                <Link
                                    to="/dev"
                                    onClick={() => setSidebarOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors mt-1",
                                        location.pathname === '/dev'
                                            ? "bg-amber-500 text-white shadow-sm"
                                            : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                    )}
                                >
                                    <Code2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <span className="flex-1 truncate">Panel Dev Labs</span>
                                </Link>
                            )}
                        </div>
                    )}
                </nav>

                {/* Footer Usuario & Acciones Rápidas */}
                <div className={cn("p-4 border-t border-border/50 bg-muted/20 transition-all duration-300", isCollapsed ? "px-2" : "")}>
                    <div className={cn("flex items-center gap-2", isCollapsed ? "flex-col" : "justify-between")}>
                        {user && (
                            <div className={cn("flex items-center min-w-0 flex-1", isCollapsed ? "justify-center w-full" : "gap-2.5")}>
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center flex-shrink-0 border border-primary/20" title={user.full_name || user.email}>
                                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                                </div>
                                {!isCollapsed && (
                                    <div className="min-w-0 flex-1 opacity-100 transition-opacity animate-in fade-in duration-300">
                                        <p className="text-sm font-semibold text-foreground truncate leading-none">{user.full_name || user.email}</p>
                                        <p className={cn("text-xs font-medium mt-1", roleInfo.color)}>
                                            {roleInfo.label}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className={cn("flex items-center flex-shrink-0", isCollapsed ? "flex-col gap-2 mt-3" : "gap-1")}>
                            <button
                                aria-label="Cambiar tema"
                                onClick={toggleTheme}
                                title={isDark ? "Modo Claro" : "Modo Oscuro"}
                                className="w-8 h-8 rounded-lg bg-secondary/50 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {isDark ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                            <button
                                aria-label="Cerrar sesión"
                                onClick={async () => { await db.auth.logout(); }}
                                title="Cerrar sesión"
                                className="w-8 h-8 rounded-lg bg-secondary/50 hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center transition-colors"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={cn(
                "flex-1 flex flex-col h-screen transition-all duration-300 overflow-x-hidden",
                isCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
            )}>
                {/* Mobile Header Enterprise */}
                <header className="lg:hidden flex items-center justify-between px-5 py-3 bg-card border-b border-border sticky top-0 z-40 safe-top shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-xs">
                            <Hotel className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-display font-bold text-lg text-foreground tracking-tight">PMS JCAR</span>
                    </div>
                    <button 
                        aria-label="Abrir menú de navegación"
                        onClick={() => setSidebarOpen(!sidebarOpen)} 
                        className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </header>

                <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1800px] w-full mx-auto overflow-x-hidden overflow-y-auto pb-24 lg:pb-10 custom-scrollbar relative">
                    <PageTransition key={location.pathname}>
                        <Outlet />
                    </PageTransition>
                </main>

                {/* Mobile Bottom Navigation (Solo visible < 1024px) */}
                <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/90 backdrop-blur-xl border-t border-border/50 flex items-center justify-around px-2 z-40 safe-bottom">
                    {[
                        { path: '/', label: 'Inicio', icon: LayoutGrid },
                        { path: '/recepcion', label: 'Recepción', icon: CalendarDays },
                        { path: '/habitaciones', label: 'Rooms', icon: BedDouble },
                        { path: '/pos', label: 'POS', icon: ShoppingCart }
                    ].map(({ path, label, icon: Icon }) => {
                        const active = location.pathname === path;
                        const badge = getBadge(path);
                        return (
                            <Link
                                key={path}
                                to={path}
                                className={cn(
                                    "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors relative",
                                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <div className="relative">
                                    <Icon className={cn("w-5 h-5", active && "animate-pulse")} />
                                    {badge > 0 && (
                                        <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card"></span>
                                    )}
                                </div>
                                <span className={cn("text-[9px] font-semibold tracking-wide", active && "font-bold")}>{label}</span>
                            </Link>
                        );
                    })}
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="flex flex-col items-center justify-center w-full h-full gap-1 transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <Menu className="w-5 h-5" />
                        <span className="text-[9px] font-semibold tracking-wide">Más</span>
                    </button>
                </nav>
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