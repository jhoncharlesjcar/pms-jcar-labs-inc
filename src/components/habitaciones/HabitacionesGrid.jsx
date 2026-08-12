
import { BedDouble } from 'lucide-react';
import { HabitacionCard } from '@/components/habitaciones/HabitacionCard';

export function HabitacionesGrid({ 
    filtradas, isLoading, filtroEstado, estadoConfig, AMENITIES_MAP, 
    parseAmenities, openEdit, del, isDeleting 
}) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="glass-panel p-5 animate-pulse h-40" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtradas.map(h => (
                    <HabitacionCard
                        key={h.id}
                        h={h}
                        estadoConfig={estadoConfig}
                        AMENITIES_MAP={AMENITIES_MAP}
                        parseAmenities={parseAmenities}
                        openEdit={openEdit}
                        del={del}
                    />
                ))}
            {filtradas.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                    <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No hay habitaciones en esta vista</p>
                </div>
            )}
        </div>
    );
}
