import { useState, memo } from 'react';
import { useHotel } from '@/lib/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const SelectorHotel = memo(function SelectorHotel({ mobile = false }) {
    const { hotelActual, hoteles, cambiarHotel } = useHotel();
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    // Solo muestra si hay más de un hotel o es developer
    const puedeVerSelector = hoteles.length > 1 || user?.role === 'developer';
    if (!puedeVerSelector || !hotelActual) return null;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={cn(
                    "flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border transition-[transform,opacity] text-left",
                    "bg-amber-50 border-amber-200 hover:bg-amber-100",
                    mobile && "text-sm"
                )}
            >
                <Building2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-amber-600 font-medium">Hotel activo</p>
                    <p className="text-sm font-bold text-amber-800 truncate">{hotelActual.nombre}</p>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-amber-600 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg z-50 overflow-hidden">
                        <div className="p-2 space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1">Cambiar propiedad</p>
                            {hoteles.map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => { cambiarHotel(h); setOpen(false); }}
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