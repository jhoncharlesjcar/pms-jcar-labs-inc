import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, memo } from 'react';
import {
    BedDouble, CalendarDays, Settings,
    Menu, X, LogOut, ShoppingCart, Code2, Building2,
    LayoutGrid, Users, CreditCard, FileText, Wallet, Sun, Moon, Package, TrendingUp
} from 'lucide-react';

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
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import OfflineSyncManager from '@/components/OfflineSyncManager';
import { canAccessPath } from '@/constants/permissions';

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

    // Mantiene la ruta activa completamente visible y evita accesos cortados
    // en el borde superior del área desplazable del menú.
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            const nav = navRef.current;
            const activeItem = nav?.querySelector('[aria-current="page"]');
            if (!nav || !activeItem) return;

            const navRect = nav.getBoundingClientRect();
            const activeRect = activeItem.getBoundingClientRect();
            const activeIsVisible = activeRect.top >= navRect.top + 4
                && activeRect.bottom <= navRect.bottom - 4;

            if (!activeIsVisible) {
                activeItem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }

            window.requestAnimationFrame(() => {
                const refreshedNavRect = nav.getBoundingClientRect();
                const firstPartialItem = Array.from(nav.querySelectorAll('a, button')).find((item) => {
                    const itemRect = item.getBoundingClientRect();
                    return itemRect.top < refreshedNavRect.top && itemRect.bottom > refreshedNavRect.top;
                });

                if (firstPartialItem) {
                    const itemRect = firstPartialItem.getBoundingClientRect();
                    nav.scrollTop -= refreshedNavRect.top - itemRect.top + 4;
                }
            });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [location.pathname, sidebarCollapsed]);

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
        <div className="app-shell flex min-h-screen font-inter">
            <OfflineSyncManager />
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar (Enterprise SaaS) */}
            <aside className={cn(
                "app-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border/70 transition-all duration-300 ease-in-out",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                sidebarCollapsed ? "w-[17rem] lg:w-[76px]" : "w-[17rem]"
            )}>
                {/* Header Marca & Logo */}
                <div className={cn("flex min-h-[76px] items-center gap-3 border-b border-border/50 p-4 transition-all duration-300", sidebarCollapsed ? "justify-center px-2" : "")}>
                    <div className={cn(
                        "overflow-hidden rounded-xl shadow-xs flex-shrink-0 flex items-center justify-center bg-white border border-border/40 transition-all duration-300 p-0.5",
                        sidebarCollapsed ? "h-10 w-10" : "h-11 w-11"
                    )}>
                        <img 
                            src="/logo.jpg"
                            alt="PMS JCAR LABS" 
                            className="w-full h-full object-contain origin-center" 
                        />
                    </div>
                    {!sidebarCollapsed && (
                        <div className="min-w-0 flex-1 opacity-100 transition-opacity duration-300">
                            <p className="truncate text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">PMS JCAR LABS</p>
                            <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Hospitality OS</p>
                        </div>
                    )}
                </div>

                {/* Selector de Hotel */}
                {!sidebarCollapsed && (
                    <div className="px-3 pt-3 animate-in fade-in zoom-in duration-300">
                        <SelectorHotel />
                    </div>
                )}

                {/* Búsqueda Global */}
                {!sidebarCollapsed && (
                    <div className="px-3 pt-2 animate-in fade-in duration-300">
                        <GlobalCommand />
                    </div>
                )}

                {/* Navegación Principal Estructurada */}
                <nav ref={navRef} className={cn("custom-scrollbar flex-1 space-y-5 overflow-y-auto pt-4", sidebarCollapsed ? "px-2" : "px-3")}>
                    {visibleNavGroups.map((group) => (
                        <div key={group.title} className="space-y-1">
                            {!sidebarCollapsed ? (
                                <p className="animate-in fade-in mb-2 px-3 text-[9px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground/65 select-none">
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
                                        aria-current={active ? 'page' : undefined}
                                        title={sidebarCollapsed ? label : undefined}
                                        className={cn(
                                            "group relative flex items-center rounded-xl text-[13px] font-semibold transition-[color,background-color,box-shadow,transform]",
                                            sidebarCollapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
                                            active
                                                ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary)/0.8)]"
                                                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                        )}
                                    >
                                        <div className="relative flex-shrink-0">
                                            <Icon className={cn("h-[18px] w-[18px] transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                                            {badge > 0 && sidebarCollapsed && (
                                                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card" />
                                            )}
                                        </div>
                                        {!sidebarCollapsed && (
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
                <div className={cn("border-t border-border/50 bg-card/45 p-3 transition-all duration-300", sidebarCollapsed ? "px-2" : "")}>
                    <div className={cn("flex items-center gap-2", sidebarCollapsed ? "flex-col" : "justify-between")}>
                        {user && (
                            <div className={cn("flex items-center min-w-0 flex-1", sidebarCollapsed ? "justify-center w-full" : "gap-2.5")}>
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary" title={user.full_name || user.email}>
                                    {(user.full_name || user.email || '?')[0].toUpperCase()}
                                </div>
                                {!sidebarCollapsed && (
                                    <div className="min-w-0 flex-1 opacity-100 transition-opacity animate-in fade-in duration-300">
                                        <p className="text-sm font-semibold text-foreground truncate leading-none">{user.full_name || user.email}</p>
                                        <p className={cn("text-xs font-medium mt-1", roleInfo.color)}>
                                            {roleInfo.label}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className={cn("flex items-center flex-shrink-0", sidebarCollapsed ? "flex-col gap-2 mt-3" : "gap-1")}>
                            <button
                                aria-label="Cambiar tema"
                                onClick={toggleTheme}
                                title={isDark ? "Modo Claro" : "Modo Oscuro"}
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                                {isDark ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                            <button
                                aria-label="Cerrar sesión"
                                onClick={async () => { await auth.logout(); }}
                                title="Cerrar sesión"
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
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
                isCollapsed ? "lg:ml-[76px]" : "lg:ml-[17rem]"
            )}>
                {/* Mobile Header Enterprise */}
                <header className="safe-top sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-card/85 px-4 py-3 shadow-xs backdrop-blur-xl lg:hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 overflow-hidden rounded-xl shadow-xs flex-shrink-0 flex items-center justify-center bg-white border border-border/40 p-0.5">
                            <img src="/logo.jpg" alt="PMS JCAR LABS" className="w-full h-full object-contain origin-center" />
                        </div>
                        <div>
                            <span className="font-display font-extrabold text-base text-foreground tracking-tight block leading-none">PMS JCAR LABS</span>
                        </div>
                    </div>
                    <button 
                        aria-label="Abrir menú de navegación"
                        aria-expanded={sidebarOpen}
                        onClick={() => setSidebarOpen(!sidebarOpen)} 
                        className="w-10 h-10 rounded-lg text-muted-foreground hover:bg-muted flex items-center justify-center active:scale-95 transition-all select-none cursor-pointer"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </header>

                <main id="main-content" className={cn(
                    "app-main custom-scrollbar relative mx-auto w-full max-w-[1740px] flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 lg:p-8 lg:pb-10 xl:p-10",
                    location.pathname === '/pos' ? "pb-0" : "pb-24"
                )}>
                    <PageTransition key={location.pathname}>
                        <Outlet />
                    </PageTransition>
                </main>

                {/* Mobile Bottom Navigation (Solo visible < 1024px) */}
                {location.pathname !== '/pos' && <nav aria-label="Navegación principal móvil" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 flex h-[4.5rem] items-center justify-around border-t border-border/60 bg-card/92 px-2 shadow-[0_-12px_30px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur-xl lg:hidden">
                    {[
                        { path: '/', label: 'Inicio', icon: LayoutGrid },
                        { path: '/recepcion', label: 'Recepción', icon: CalendarDays },
                        { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
                        { path: '/pos', label: 'POS', icon: ShoppingCart },
                        { path: '/limpieza', label: 'Limpieza', icon: BroomIcon }
                    ].filter(item => canAccessPath(user?.role, item.path)).slice(0, 4).map(({ path, label, icon: Icon }) => {
                        const active = location.pathname === path;
                        const badge = getBadge(path);
                        return (
                            <Link
                                key={path}
                                to={path}
                                aria-current={active ? 'page' : undefined}
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
                </nav>}
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
