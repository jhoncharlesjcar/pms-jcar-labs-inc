import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    LayoutDashboard, BedDouble, CalendarDays, Receipt, Settings,
    Menu, X, Hotel, ChevronRight, LogOut, ShoppingCart, Code2, Building2,
    LayoutGrid, Users, Package, CreditCard, Bell, FileText, Wallet, Sun, Moon
} from 'lucide-react';
import { db } from '@/api/db';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import SelectorHotel from '@/components/SelectorHotel';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GestionHotelesAdmin from '@/components/admin/GestionHotelesAdmin';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutGrid, color: 'bg-[#007041]' }, 
    { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble, color: 'bg-[#2D63ED]' }, 
    { path: '/recepcion', label: 'Recepción', icon: CalendarDays, color: 'bg-[#7C3AED]' }, 
    { path: '/huespedes', label: 'Huéspedes', icon: Users, color: 'bg-[#10b981]' }, 
    { path: '/ventas', label: 'Ventas', icon: CreditCard, color: 'bg-[#0284C7]' }, 
    { path: '/caja', label: 'Caja', icon: Wallet, color: 'bg-[#8B5CF6]' }, 
    { path: '/reportes', label: 'Reportes', icon: FileText, color: 'bg-[#4F46E5]' }, 
    { path: '/pos', label: 'Punto de Venta', icon: ShoppingCart, color: 'bg-[#D97706]' }, 
    { path: '/configuracion', label: 'Configuración', icon: Settings, color: 'bg-[#4B5563]' }, 
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
        <div className="min-h-screen bg-background flex font-inter">
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar (Premium Glass) */}
            <aside className={cn(
                "fixed top-0 left-0 h-full w-[280px] sm:w-72 bg-card/40 backdrop-blur-3xl border-r border-border/50 z-50 flex flex-col transition-all duration-700 ease-in-out shadow-2xl",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>
                {/* Logo Section with Glow */}
                <div className="p-8 border-b border-border/10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/20 backdrop-blur-xl rounded-2xl flex items-center justify-center border border-primary/30 shadow-lg shadow-primary/10 group overflow-hidden relative">
                            <Hotel className="w-6 h-6 text-primary group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div>
                            <p className="font-display text-lg font-black text-foreground leading-tight tracking-tight">ANGELICA FREY</p>
                            <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Gestión de Hospedaje</p>
                        </div>
                    </div>
                </div>

                {/* Selector de hotel (Premium Styling) */}
                {!isDeveloper && (
                    <div className="px-5 pt-8">
                        <div className="bg-secondary/5 border border-secondary/10 p-1 rounded-[1.5rem]">
                            <SelectorHotel />
                        </div>
                    </div>
                )}

                {/* Main Navigation */}
                <nav className="flex-1 px-5 pt-8 space-y-2 overflow-y-auto custom-scrollbar">
                    <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-[0.4em] px-5 mb-6">Navegación</p>
                    {navItems.map(({ path, label, icon: Icon, color }) => {
                        const active = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                    "flex items-center gap-4 px-5 py-3.5 rounded-[1.25rem] text-sm transition-all duration-500 group relative overflow-hidden",
                                    active
                                        ? "bg-primary text-white shadow-xl shadow-primary/20 font-bold"
                                        : "text-muted-foreground hover:bg-secondary/10 hover:text-foreground"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center shadow-sm transition-all duration-500 group-hover:rotate-6",
                                    active ? "bg-white/20" : color
                                )}>
                                    <Icon className={cn("w-4 h-4", active ? "text-white" : "text-white")} />
                                </div>
                                <span className="flex-1 tracking-tight">{label}</span>
                                {active && (
                                    <motion.div layoutId="nav-active" className="absolute left-0 w-1 h-6 bg-white/40 rounded-r-full" />
                                )}
                            </Link>
                        );
                    })}

                    {/* Admin Section Separator */}
                    {(isAdmin || isDeveloper) && (
                        <div className="pt-8 pb-4">
                            <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent mx-5" />
                        </div>
                    )}

                    {isAdmin && (
                        <button
                            onClick={() => { setGestionModal(true); setSidebarOpen(false); }}
                            className="flex items-center gap-4 px-5 py-3.5 rounded-[1.25rem] text-sm font-bold transition-all w-full text-blue-500 hover:bg-blue-500/10 border border-blue-500/5 group"
                        >
                            <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="flex-1 text-left tracking-tight">Hoteles & Staff</span>
                        </button>
                    )}

                    {isDeveloper && (
                        <Link
                            to="/dev"
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                                "flex items-center gap-4 px-5 py-3.5 rounded-[1.25rem] text-sm font-bold transition-all border group",
                                location.pathname === '/dev'
                                    ? "bg-amber-500 text-white shadow-xl shadow-amber-500/20 border-transparent"
                                    : "text-amber-600 hover:bg-amber-500/10 border-amber-500/10 hover:border-amber-500/30"
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-transform group-hover:-rotate-12",
                                location.pathname === '/dev' ? "bg-white/20" : "bg-amber-500"
                            )}>
                                <Code2 className="w-4 h-4 text-white" />
                            </div>
                            <span className="flex-1 tracking-tight">Panel Dev Labs</span>
                        </Link>
                    )}
                </nav>

                {/* Bottom Section (Premium Theme Switch & Profile) */}
                <div className="p-6 space-y-6">
                    {/* Theme Switcher Compact */}
                    <div className="px-4 py-3 bg-secondary/5 rounded-2xl border border-border/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-background/50 flex items-center justify-center border border-border/50">
                                {isDark ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-primary" />}
                            </div>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tema {isDark ? 'Oscuro' : 'Claro'}</span>
                        </div>
                        <Switch 
                            checked={isDark} 
                            onCheckedChange={toggleTheme}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>

                    {user && (
                        <div className="p-4 bg-card/60 backdrop-blur-xl rounded-3xl border border-border/20 shadow-xl group hover:border-primary/30 transition-all">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-gradient-to-tr from-primary to-emerald-400 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:rotate-3 transition-transform">
                                    <span className="text-sm font-black text-white">
                                        {(user.full_name || user.email || '?')[0].toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-black text-foreground truncate tracking-tight">{user.full_name || user.email}</p>
                                    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg mt-1 bg-primary/10", roleInfo.color.split(' ')[1])}>
                                        <div className="w-1 h-1 rounded-full bg-current" />
                                        <p className="text-[8px] font-black uppercase tracking-widest">
                                            {roleInfo.label}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={async () => { await db.auth.logout(); }}
                        className="flex items-center gap-4 px-6 py-4 rounded-[1.5rem] text-xs font-black text-red-500 hover:bg-red-500 hover:text-white transition-all w-full border border-red-500/10 shadow-sm hover:shadow-red-500/20 group"
                    >
                        <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        CERRAR SESIÓN
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 lg:ml-72 flex flex-col min-h-screen transition-all duration-500 overflow-x-hidden">
                {/* Mobile Header */}
                <header className="lg:hidden flex items-center justify-between px-5 py-4 bg-background/80 backdrop-blur-2xl border-b border-border/50 sticky top-0 z-40 safe-top">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                            <Hotel className="w-5 h-5 text-primary" />
                        </div>
                        <span className="font-display font-black text-foreground tracking-tighter">ANGELICA FREY</span>
                    </div>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 rounded-xl bg-card border border-border shadow-sm active:scale-90 transition-all">
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[100vw] overflow-x-hidden pb-20 lg:pb-10">
                    <Outlet />
                </main>
            </div>

            {/* Barra de Navegación Inferior (Móvil) */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 sm:h-20 bg-background/80 backdrop-blur-3xl border-t border-border/50 z-40 px-2 safe-bottom">
                <nav className="flex items-center justify-around h-full max-w-lg mx-auto">
                    {[
                        { path: '/', icon: LayoutGrid, label: 'Dashboard' },
                        { path: '/recepcion', icon: CalendarDays, label: 'Recep.' },
                        { path: '/habitaciones', icon: BedDouble, label: 'Hab.' },
                        { path: '/pos', icon: ShoppingCart, label: 'POS' },
                        { path: '/reportes', icon: FileText, label: 'Rep.' },
                    ].map(({ path, icon: Icon, label }) => {
                        const active = location.pathname === path;
                        return (
                            <Link
                                key={path}
                                to={path}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300",
                                    active ? "text-primary" : "text-muted-foreground/60"
                                )}
                            >
                                <div className={cn(
                                    "p-1.5 rounded-xl transition-all duration-300",
                                    active ? "bg-primary/10 shadow-inner" : ""
                                )}>
                                    <Icon className={cn("w-5 h-5", active ? "stroke-[2.5px]" : "stroke-2")} />
                                </div>
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest",
                                    active ? "opacity-100" : "opacity-40"
                                )}>{label}</span>
                                {active && (
                                    <motion.div layoutId="bottom-nav-active" className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Modal Gestión Hoteles & Staff */}
            <Dialog open={gestionModal} onOpenChange={setGestionModal}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-card/95 backdrop-blur-3xl border-border/50 shadow-2xl rounded-[2.5rem]">
                    <DialogHeader>
                        <DialogTitle className="font-display flex items-center gap-3 text-2xl">
                            <div className="p-2 bg-blue-500/10 rounded-xl">
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
}