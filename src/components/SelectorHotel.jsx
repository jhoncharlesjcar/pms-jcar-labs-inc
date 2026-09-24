import { useState, memo } from 'react';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const SelectorHotel = memo(function SelectorHotel(/** @type {any} */ { mobile = false, compact = false }) {
    const { hotelActual, hoteles, cambiarHotel } = useHotel();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    const puedeVerSelector = hoteles.length > 1 || user?.role === 'developer';
    if (!puedeVerSelector || !hotelActual) return null;

    const nombre = (hotelActual.nombre || 'Hotel').trim();
    const iconOnly = compact || mobile;

    return (
        <div className={cn('relative', !iconOnly && 'w-full min-w-0')}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Hotel activo: ${nombre}. Cambiar propiedad`}
                title={nombre}
                onClick={() => setOpen(!open)}
                className={cn(
                    'flex items-center rounded-lg border text-left transition-colors',
                    iconOnly
                        ? 'h-8 w-8 justify-center border-border/70 bg-secondary/70 text-foreground hover:bg-secondary'
                        : 'h-9 w-full min-w-0 gap-2 border-border/80 bg-secondary/50 px-2.5 text-foreground hover:bg-secondary'
                )}
            >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {!iconOnly && (
                    <>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-none">{nombre}</span>
                        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        role="listbox"
                        aria-label="Propiedades disponibles"
                        className={cn(
                            'absolute top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-lg',
                            iconOnly ? 'right-0 w-64' : 'left-0 w-full min-w-[14rem]'
                        )}
                    >
                        <div className="space-y-1 p-2">
                            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Propiedad activa</p>
                            {hoteles.map(h => (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={hotelActual?.id === h.id}
                                    key={h.id}
                                    onClick={() => { cambiarHotel(h.id); setOpen(false); }}
                                    className={cn(
                                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left',
                                        hotelActual?.id === h.id
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-foreground hover:bg-secondary'
                                    )}
                                >
                                    <Building2 className="h-4 w-4 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">{(h.nombre || '').trim()}</p>
                                        {h.ciudad && <p className="text-xs text-muted-foreground">{h.ciudad}</p>}
                                    </div>
                                    {hotelActual?.id === h.id && <Check className="h-4 w-4 flex-shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
});
SelectorHotel.displayName = 'SelectorHotel';
export default SelectorHotel;
