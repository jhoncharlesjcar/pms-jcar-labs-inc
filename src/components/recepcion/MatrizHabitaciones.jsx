import React, { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * @param {{ habitacionesDisp: any[], form: any, seleccionarHab: function }} props
 */
function MatrizHabitacionesInner({ habitacionesDisp, form, seleccionarHab }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {habitacionesDisp.map(h => (
                <button 
                    key={h.id} 
                    onClick={() => seleccionarHab(h)} 
                    type="button"
                    className={cn(
                        "p-4 rounded-xl border-2 text-left transition-colors relative overflow-hidden group h-24 flex flex-col justify-center",
                        form.habitacion_id === h.id
                            ? "border-primary bg-primary/5 shadow-inner"
                            : "border-border/50 bg-background/50 hover:border-primary/50 hover:bg-background"
                    )}>
                    <p className="font-black text-xl leading-none">#{h.numero}</p>
                    <p className="text-xs text-muted-foreground uppercase font-black tracking-tight mt-1 truncate">{h.tipo}</p>
                    <p className="text-xs font-bold text-primary mt-1">S/{h.precio ?? h.precio_noche ?? 0}</p>
                    {form.habitacion_id === h.id && (
                        <div className="absolute inset-0 bg-primary/5 -z-0" />
                    )}
                </button>
            ))}
            {habitacionesDisp.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-muted-foreground bg-secondary/10 rounded-2xl border border-dashed border-border">
                    No hay habitaciones disponibles
                </p>
            )}
        </div>
    );
}

const MatrizHabitaciones = memo(MatrizHabitacionesInner);
MatrizHabitaciones.displayName = 'MatrizHabitaciones';
export default MatrizHabitaciones;
