import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, BedDouble, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function SeleccionReserva({ reservaSeleccionada, onSeleccionar, onLimpiar }) {
    const [busqueda, setBusqueda] = useState('');

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas'],
        queryFn: () => base44.entities.Reserva.filter({ estado: 'activa' }),
    });

    const filtradas = reservas.filter(r =>
        !busqueda ||
        r.huesped_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        r.habitacion_numero?.includes(busqueda)
    );

    if (reservaSeleccionada) {
        return (
            <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 flex items-center justify-between">
                <div>
                    <p className="text-xs text-primary font-medium">Reserva vinculada</p>
                    <p className="font-semibold text-foreground text-sm">{reservaSeleccionada.huesped_nombre}</p>
                    <p className="text-xs text-muted-foreground">Hab. {reservaSeleccionada.habitacion_numero} · {reservaSeleccionada.noches} noche(s) · S/ {reservaSeleccionada.total?.toFixed(2)}</p>
                </div>
                <button onClick={onLimpiar} className="w-7 h-7 rounded-lg bg-secondary hover:bg-border flex items-center justify-center transition-colors">
                    <X className="w-4 h-4 text-muted-foreground" />
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vincular reserva activa (opcional)</p>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar huésped o hab..." className="pl-8 h-8 text-sm" />
            </div>
            {busqueda && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filtradas.map(r => (
                        <button key={r.id} onClick={() => { onSeleccionar(r); setBusqueda(''); }}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
                            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                                <BedDouble className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{r.huesped_nombre}</p>
                                <p className="text-xs text-muted-foreground">Hab. {r.habitacion_numero} · {r.noches} noche(s) · S/ {r.total?.toFixed(2)}</p>
                            </div>
                        </button>
                    ))}
                    {filtradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sin reservas activas</p>}
                </div>
            )}
        </div>
    );
}