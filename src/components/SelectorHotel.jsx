import { useState, memo } from 'react';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SelectorHotel = memo(function SelectorHotel(/** @type {any} */ { mobile = false, compact = false }) {
    const { hotelActual, hoteles, cambiarHotel } = useHotel();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    const puedeVerSelector = hoteles.length > 1 || user?.role === 'developer';
    if (!puedeVerSelector || !hotelActual) return null;

    const nombre = (hotelActual.nombre || 'Hotel').trim();

    return (
        <div className="relative">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Hotel activo: ${nombre}. Cambiar propiedad`}
                title={nombre}
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-[transform,background-color] hover:bg-primary/90",
                    compact || mobile ? "h-8 w-8" : "h-8 max-w-[11.5rem] gap-1.5 px-2.5"
                )}
            >
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {!compact && !mobile && (
                    <span className="truncate text-[11px] font-semibold leading-none tracking-tight">{nombre}</span>
                )}
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div role="listbox" aria-label="Propiedades disponibles" className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-2 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1">Propiedad activa</p>
                            {hoteles.map(h => (
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={hotelActual?.id === h.id}
                                    key={h.id}
                                    onClick={() => { cambiarHotel(h.id); setOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-[transform,opacity]",
                                        hotelActual?.id === h.id
                                            ? "bg-primary/10 text-primary"
                                            : "hover:bg-secondary text-foreground"
                                    )}
                                >
                                    <Building2 className="w-4 h-4 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{(h.nombre || '').trim()}</p>
                                        {h.ciudad && <p className="text-xs text-muted-foreground">{h.ciudad}</p>}
                                    </div>
                                    {hotelActual?.id === h.id && <Check className="w-4 h-4 flex-shrink-0" />}
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
