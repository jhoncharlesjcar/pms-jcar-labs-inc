import { useState, memo } from 'react';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SelectorHotel = memo(function SelectorHotel(/** @type {any} */ { mobile = false }) {
    const { hotelActual, hoteles, cambiarHotel } = useHotel();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);


    // Solo muestra si hay más de un hotel o es developer
    const puedeVerSelector = hoteles.length > 1 || user?.role === 'developer';
    if (!puedeVerSelector || !hotelActual) return null;

    return (
        <div className="relative">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Hotel activo: ${hotelActual.nombre}. Cambiar propiedad`}
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-[transform,background-color] hover:bg-primary/90",
                    mobile && "h-7 w-7 text-xs"
                )}
            >
                <Building2 className="h-4 w-4" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div role="listbox" aria-label="Propiedades disponibles" className="absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-2 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1">Cambiar propiedad</p>
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
                                        <p className="text-sm font-medium truncate">{h.nombre}</p>
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
