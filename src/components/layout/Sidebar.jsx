import { Link } from 'react-router-dom';
import { useRef, useEffect } from 'react';
import { Code2, Building2, Sun, Moon, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import SelectorHotel from '@/components/SelectorHotel';
import { GlobalCommand } from '@/components/GlobalCommand';

const ROLE_LABELS = {
    admin: { label: 'Admin', color: 'text-primary' },
    recepcionista: { label: 'Recepción', color: 'text-emerald-500' },
    developer: { label: 'Dev', color: 'text-amber-500' },
    user: { label: 'Usuario', color: 'text-muted-foreground' },
};

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    isCollapsed,
    visibleNavGroups,
    location,
    user,
    auth,
    getBadge,
    setGestionModal,
    isDark,
    toggleTheme,
    isAdmin,
    isDeveloper
}) {
    const navRef = useRef(null);
    const sidebarTweenRef = useRef(null);
    const roleInfo = ROLE_LABELS[user?.role] || ROLE_LABELS['user'];

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

    // Mantiene la ruta activa completamente visible
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

    return (
        <>
            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/40 z-20 lg:hidden backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            )}
            <aside className={cn(
                "app-sidebar fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-border/70 transition-all duration-300 ease-in-out bg-background",
                sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
                sidebarCollapsed ? "w-[17rem] lg:w-[76px]" : "w-[17rem]"
            )}>
                {/* Header Marca & Logo */}
                <div className={cn("flex min-h-[76px] flex-col justify-center gap-3 border-b border-border/50 p-4 transition-all duration-300", sidebarCollapsed ? "items-center px-2 py-3" : "")}>
                    <div className={cn("flex w-full items-center gap-3", sidebarCollapsed && "justify-center")}>
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
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">PMS JCAR LABS</p>
                            <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">Hospitality OS</p>
                        </div>
                    )}
                    </div>
                    {!sidebarCollapsed && <SelectorHotel />}
                    {sidebarCollapsed && <SelectorHotel compact />}
                </div>

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
                                <p className="mb-2 px-3 text-xs font-medium text-muted-foreground select-none">
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
                                            "group relative flex min-h-11 items-center rounded-xl text-sm font-semibold transition-[color,background-color,box-shadow]",
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
                                                    <span className="ml-auto px-1.5 py-0.5 text-xs font-black bg-destructive text-destructive-foreground rounded-full min-w-[18px] text-center shadow-xs animate-in fade-in zoom-in">
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
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 w-full transition-colors cursor-pointer"
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
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                            >
                                {isDark ? <Moon className="w-3.5 h-3.5 text-amber-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
                            </button>
                            <button
                                aria-label="Cerrar sesión"
                                onClick={async () => { await auth.logout(); }}
                                title="Cerrar sesión"
                                className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive cursor-pointer"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}
