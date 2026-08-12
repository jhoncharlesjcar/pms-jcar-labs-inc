// @ts-nocheck
import { useMemo, memo } from 'react';
import { addDays, format, startOfDay, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CalendarDays } from 'lucide-react';

import { toast } from 'sonner';

const estadoBadge = {
    pendiente: 'bg-orange-500',
    activa: 'bg-primary',
    finalizada: 'bg-green-500',
    cancelada: 'bg-red-500',
};

const CalendarioReservas = memo(function CalendarioReservas({ habitaciones, reservas, onReservaClick, onReservaMover }) {
    const dias = useMemo(() => {
        const arr = [];
        const hoy = startOfDay(new Date());
        for (let i = 0; i < 30; i++) {
            arr.push(addDays(hoy, i));
        }
        return arr;
    }, []);

    const matriz = useMemo(() => {
        const m = {};
        habitaciones.forEach(h => {
            m[h.id] = { ...h, reservas: [] };
        });
        
        reservas.forEach(r => {
            if (r.estado === 'cancelada') return;
            if (m[r.habitacion_id]) {
                m[r.habitacion_id].reservas.push(r);
            }
        });
        
        return Object.values(m).sort((a,b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.numero).localeCompare(String(b.numero));
        });
    }, [habitaciones, reservas]);

    const handleDrop = (e, targetHabId, targetHabNumero, targetDia) => {
        e.preventDefault();
        const reservaId = e.dataTransfer.getData('text/plain');
        const res = reservas.find(r => r.id === reservaId);
        if (!res) return;

        const noches = res.noches || 1;
        const nuevaEntrada = format(targetDia, 'yyyy-MM-dd');
        const nuevaSalida = format(addDays(targetDia, noches), 'yyyy-MM-dd');

        // Validar si es el mismo lugar
        if (res.habitacion_id === targetHabId && res.fecha_entrada === nuevaEntrada) {
            return;
        }

        // Colisión check
        const colision = reservas.some(r => {
            if (r.id === res.id || r.habitacion_id !== targetHabId || r.estado === 'cancelada') return false;
            const rStart = new Date(r.fecha_entrada + 'T12:00:00');
            const rEnd = new Date(r.fecha_salida + 'T12:00:00');
            const targetStart = new Date(nuevaEntrada + 'T12:00:00');
            const targetEnd = new Date(nuevaSalida + 'T12:00:00');
            return targetStart < rEnd && targetEnd > rStart;
        });

        if (colision) {
            toast.error(`Conflicto: Habitación #${targetHabNumero} ya reservada en esas fechas`, {
                style: {
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    backdropFilter: 'blur(16px)'
                }
            });
            return;
        }

        onReservaMover?.({
            id: res.id,
            habitacion_id: targetHabId,
            habitacion_numero: targetHabNumero,
            fecha_entrada: nuevaEntrada,
            fecha_salida: nuevaSalida
        });
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-[2rem] overflow-hidden shadow-2xl relative select-none">
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[1200px]">
                    {/* Header: Días */}
                    <div className="flex border-b border-border/50 bg-secondary/20">
                        <div className="w-32 flex-shrink-0 border-r border-border/50 p-4 font-black text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" /> Hab.
                        </div>
                        {dias.map((dia, i) => (
                            <div key={i} className="flex-1 min-w-[60px] text-center p-2 border-r border-border/10 flex flex-col items-center justify-center">
                                <span className="text-xs font-bold uppercase text-muted-foreground">{format(dia, 'EEEEEE', { locale: es })}</span>
                                <span className={cn(
                                    "text-sm font-bold mt-0.5 w-7 h-7 rounded-full flex items-center justify-center",
                                    i === 0 ? "bg-primary text-primary-foreground" : "text-foreground"
                                )}>
                                    {format(dia, 'd')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Body: Habitaciones */}
                    <div className="divide-y divide-border/20">
                        {matriz.map((hab) => (
                            <div key={hab.id} className="flex relative h-16 hover:bg-secondary/5 transition-colors">
                                {/* Label de habitación */}
                                <div className="w-32 flex-shrink-0 border-r border-border/50 p-3 flex flex-col justify-center bg-card/50 z-10 sticky left-0">
                                    <p className="font-bold text-foreground">Hab. {hab.numero}</p>
                                    <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">{hab.tipo}</p>
                                </div>
                                
                                {/* Celdas de días (Grid background y zonas de soltado) */}
                                <div className="flex flex-1 relative">
                                    {dias.map((dia, i) => (
                                        <div 
                                            key={i} 
                                            className="flex-1 min-w-[60px] border-r border-border/5 transition-colors duration-200"
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnter={(e) => e.currentTarget.classList.add('bg-primary/10')}
                                            onDragLeave={(e) => e.currentTarget.classList.remove('bg-primary/10')}
                                            onDrop={(e) => {
                                                e.currentTarget.classList.remove('bg-primary/10');
                                                handleDrop(e, hab.id, hab.numero, dia);
                                            }}
                                        />
                                    ))}

                                    {/* Bloques de Reservas */}
                                    {hab.reservas.map(r => {
                                        const rStart = startOfDay(new Date(r.fecha_entrada));
                                        const rEnd = startOfDay(new Date(r.fecha_salida));
                                        const pStart = dias[0];
                                        const pEnd = dias[dias.length - 1];

                                        if (rEnd < pStart || rStart > pEnd) return null;

                                        // Calcular posiciones
                                        let startIdx = differenceInDays(rStart, pStart);
                                        let length = differenceInDays(rEnd, rStart);
                                        
                                        if (length <= 0) length = 1; // Mínimo 1 bloque
                                        if (startIdx < 0) {
                                            length += startIdx;
                                            startIdx = 0;
                                        }
                                        
                                        if (startIdx + length > dias.length) {
                                            length = dias.length - startIdx;
                                        }

                                        const leftPercent = (startIdx / dias.length) * 100;
                                        const widthPercent = (length / dias.length) * 100;

                                        const isDraggable = r.estado === 'pendiente' || r.estado === 'activa';

                                        return (
                                            <div
                                                key={r.id}
                                                draggable={isDraggable}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', r.id);
                                                    e.currentTarget.style.opacity = '0.5';
                                                    e.currentTarget.classList.add('scale-95');
                                                }}
                                                onDragEnd={(e) => {
                                                    e.currentTarget.style.opacity = '1';
                                                    e.currentTarget.classList.remove('scale-95');
                                                }}
                                                className={cn(
                                                    "absolute top-2 bottom-2 rounded-xl shadow-lg flex flex-col justify-center px-3 cursor-grab active:cursor-grabbing hover:brightness-110 transition overflow-hidden text-foreground border border-border/50 z-20",
                                                    estadoBadge[r.estado] || 'bg-gray-500',
                                                    !isDraggable && 'cursor-default opacity-85 hover:brightness-100'
                                                )}
                                                style={{ left: `calc(${leftPercent}% + 4px)`, width: `calc(${widthPercent}% - 8px)` }}
                                                onClick={() => onReservaClick?.(r)}
                                            >
                                                <p className="text-xs font-bold truncate">{r.huesped_nombre}</p>
                                                <p className="text-xs font-medium opacity-80 truncate">{r.estado.toUpperCase()}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {matriz.length === 0 && (
                <div className="p-10 text-center text-muted-foreground">
                    No hay habitaciones registradas.
                </div>
            )}
        </div>
    );
});
CalendarioReservas.displayName = 'CalendarioReservas';
export default CalendarioReservas;
