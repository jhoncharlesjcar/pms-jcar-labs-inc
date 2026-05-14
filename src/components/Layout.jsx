import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    LayoutDashboard, BedDouble, CalendarDays, Receipt, Settings,
    Menu, X, Hotel, ChevronRight, LogOut, ShoppingCart, Code2, Building2
} from 'lucide-react';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import SelectorHotel from '@/components/SelectorHotel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GestionHotelesAdmin from '@/components/admin/GestionHotelesAdmin';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
    { path: '/recepcion', label: 'Recepción', icon: CalendarDays },
    { path: '/ventas', label: 'Ventas & Tickets', icon: Receipt },
    { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart },
    { path: '/configuracion', label: 'Configuración', icon: Settings },
];

const ROLE_LABELS = {
    admin: { label: 'Administrador', color: 'bg-primary/10 text-primary' },
    recepcionista: { label: 'Recepcionista', color: 'bg-green-100 text-green-700' },
    developer: { label: 'Developer', color: 'bg-amber-100 text-amber-700' },
    user: { label: 'Usuario', color: 'bg-secondary text-secondary-foreground' },
};

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const location = useLocation();
    const { user } = useAuth();

    const isDeveloper = user?.role === 'developer';
    const isAdmin = user?.role === 'admin';
    const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS['user'];
    const [gestionModal, setGestionModal] = useState(false);
    const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

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
        <div className="min-h-screen bg-background flex">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={cn(
                "fixed top-0 left-0 h-full w-64 bg-card/80 backdrop-blur-xl border-r border-border/50 z-30 flex flex-col transition-transform duration-300",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Logo */}
                <div className="p-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center">
                            <Hotel className="w-5 h-5 text-primary-foreground" />
                        </div>
                        <div>
                            <p className="font-display text-base font-bold text-foreground leading-tight">HOSPEDAJE ANGELICA FREY</p>
                            <p className="text-xs text-muted-foreground">System Hotel By Jcar Labs</p>
                        </div>
                    </div>
                </div>

                {/* Selector de hotel — para admin y recepcionista */}
                {!isDeveloper && (
                    <div className="px-4 pt-4">
                        <SelectorHotel />
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems.map(({ path, label, icon: Icon }) => {
                        const active = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                    active
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                <Icon className="w-4 h-4 flex-shrink-0" />
                                <span className="flex-1">{label}</span>
                                {active && <ChevronRight className="w-3 h-3 opacity-60" />}
                            </Link>
                        );
                    })}

                    {/* Botón Hoteles & Staff — SOLO para admin */}
                    {isAdmin && (
                        <>
                            <div className="pt-3 pb-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4">Gestión</p>
                            </div>
                            <button
                                onClick={() => { setGestionModal(true); setSidebarOpen(false); }}
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                            >
                                <Building2 className="w-4 h-4 flex-shrink-0" />
                                <span className="flex-1 text-left">Hoteles & Staff</span>
                                <ChevronRight className="w-3 h-3 opacity-60" />
                            </button>
                        </>
                    )}

                    {/* Panel Dev — SOLO para developer */}
                    {isDeveloper && (
                        <>
                            <div className="pt-3 pb-1">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-4">Dev</p>
                            </div>
                            <Link
                                to="/dev"
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                    location.pathname === '/dev'
                                        ? "bg-amber-500 text-white shadow-md"
                                        : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                                )}
                            >
                                <Code2 className="w-4 h-4 flex-shrink-0" />
                                <span className="flex-1">Panel Dev</span>
                                <ChevronRight className="w-3 h-3 opacity-60" />
                            </Link>
                        </>
                    )}
                </nav>

                {/* User info + Logout */}
                <div className="p-4 border-t border-border space-y-3">
                    {/* Dark Mode Toggle */}
                    <div className="flex items-center justify-between px-4 py-2 bg-secondary rounded-xl">
                        <span className="text-sm font-medium">Modo Oscuro</span>
                        <button
                            onClick={toggleTheme}
                            className={cn(
                                "w-11 h-6 rounded-full transition-colors relative focus:outline-none",
                                isDark ? "bg-green-500" : "bg-gray-300"
                            )}
                        >
                            <div className={cn(
                                "w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm",
                                isDark ? "translate-x-5.5 left-0.5" : "translate-x-0.5"
                            )} style={{ transform: isDark ? 'translateX(22px)' : 'translateX(2px)' }} />
                        </button>
                    </div>

                    {user && (
                        <div className="px-3 py-2.5 bg-secondary rounded-xl">
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                                    <span className="text-xs font-bold text-primary">
                                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-foreground truncate flex-1">{user.full_name || user.email}</p>
                            </div>
                            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", roleInfo.color)}>
                                {roleInfo.label}
                            </span>
                        </div>
                    )}
                    <button
                        onClick={async () => { 
                            console.log('Click en Cerrar Sesión'); 
                            await db.auth.logout(); 
                        }}
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Cerrar sesión
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
                {/* Top bar mobile */}
                <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                            <Hotel className="w-4 h-4 text-primary-foreground" />
                        </div>
                        <span className="font-display font-bold text-foreground">HOSPEDAJE ANGELICA FREY</span>
                    </div>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-secondary">
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </header>

                <main className="flex-1 p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>

            {/* Modal Gestión Hoteles & Staff para Admin */}
            <Dialog open={gestionModal} onOpenChange={setGestionModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-primary" /> Hoteles & Staff
                        </DialogTitle>
                    </DialogHeader>
                    <GestionHotelesAdmin onClose={() => setGestionModal(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}