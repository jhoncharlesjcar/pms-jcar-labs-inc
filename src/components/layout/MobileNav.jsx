import { Link, useLocation } from 'react-router-dom';
import { Menu, LayoutGrid, CalendarDays, BedDouble, ShoppingCart } from 'lucide-react';
import BroomIcon from '@/components/ui/icons/BroomIcon';
import { cn } from '@/lib/utils';
import { canAccessPath } from '@/constants/permissions';

export default function MobileNav({ user, getBadge, setSidebarOpen }) {
    const location = useLocation();

    if (location.pathname === '/pos') return null;

    const navItems = [
        { path: '/', label: 'Inicio', icon: LayoutGrid },
        { path: '/recepcion', label: 'Recepción', icon: CalendarDays },
        { path: '/habitaciones', label: 'Habitaciones', icon: BedDouble },
        { path: '/pos', label: 'POS', icon: ShoppingCart },
        { path: '/limpieza', label: 'Limpieza', icon: BroomIcon }
    ].filter(item => canAccessPath(user?.role, item.path)).slice(0, 4);

    return (
        <nav aria-label="Navegación principal móvil" className="safe-bottom fixed bottom-0 left-0 right-0 z-40 flex h-[4.5rem] items-center justify-around border-t border-border/60 bg-card/92 px-2 shadow-[0_-12px_30px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur-xl lg:hidden">
            {navItems.map(({ path, label, icon: Icon }) => {
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
                            <Icon className={cn("w-5 h-5 transition-all duration-300", active && "scale-110 drop-shadow-md text-primary")} />
                            {badge > 0 && (
                                <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-card"></span>
                            )}
                        </div>
                        <span className={cn("text-xs font-semibold tracking-wide transition-all", active && "font-bold scale-105")}>{label}</span>
                    </Link>
                );
            })}
            <button
                onClick={() => setSidebarOpen(true)}
                className="flex flex-col items-center justify-center w-full h-full gap-1 transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
            >
                <Menu className="w-5 h-5" />
                <span className="text-xs font-semibold tracking-wide">Más</span>
            </button>
        </nav>
    );
}
