import React, { useMemo, useState } from 'react';
import { format, addDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const avatarColors = {
    activa: 'from-primary to-primary/70',
    pendiente: 'from-orange-500 to-amber-500',
    finalizada: 'from-green-500 to-emerald-500',
    cancelada: 'from-red-500 to-rose-500',
};

const RecepcionTimeline = ({ reservas, habitaciones }) => {
    const [baseDate, setBaseDate] = useState(new Date());

    // Generate 14 days of timeline (1 week before, 1 week after baseDate approximately, or just 14 days starting from today)
    const days = useMemo(() => {
        const start = baseDate;
        const end = addDays(start, 13);
        return eachDayOfInterval({ start, end });
    }, [baseDate]);

    // Agrupar habitaciones por piso para el timeline
    const habitacionesAgrupadas = useMemo(() => {
        const habsFiltradas = habitaciones.sort((a, b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.numero).localeCompare(String(b.numero));
        });
        const grupos = {};
        habsFiltradas.forEach(h => {
            const piso = h.piso?.trim() || 'Sin Piso';
            if (!grupos[piso]) grupos[piso] = [];
            grupos[piso].push(h);
        });
        return grupos;
    }, [habitaciones]);

    const getReservaForDay = (habId, day) => {
        return reservas.find(r => {
            if (r.habitacion_id !== habId) return false;
            if (r.estado === 'cancelada') return false;
            const start = new Date(r.fecha_entrada);
            const end = new Date(r.fecha_salida);
            // La reserva ocupa este día si el día es >= start y < end (salida)
            // Si entra y sale el mismo día, cuenta para ese día
            if (isSameDay(start, end)) return isSameDay(day, start);
            return (day >= start && day < end) || isSameDay(day, start);
        });
    };

    const pisosOrdenados = Object.keys(habitacionesAgrupadas).sort((a, b) => {
        if (a === 'Sin Piso') return 1;
        if (b === 'Sin Piso') return -1;
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    return (
        <div className="bg-card border border-border/50 rounded-xl overflow-hidden shadow-sm flex flex-col animate-in fade-in duration-300">
            {/* Toolbar */}
            <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                    <button onClick={() => setBaseDate(addDays(baseDate, -7))} className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setBaseDate(new Date())} className="px-3 h-8 rounded-md bg-background border border-border text-xs font-semibold hover:bg-muted transition-colors">
                        Hoy
                    </button>
                    <button onClick={() => setBaseDate(addDays(baseDate, 7))} className="w-8 h-8 rounded-md bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
                <div className="text-sm font-semibold capitalize">
                    {format(days[0], "MMMM yyyy", { locale: es })}
                </div>
            </div>

            {/* Timeline Grid */}
            <div className="overflow-x-auto custom-scrollbar">
                <div className="min-w-[800px] lg:min-w-full inline-block align-middle pb-4">
                    {/* Header Row (Days) */}
                    <div className="flex border-b border-border/50 sticky top-0 bg-card z-10">
                        <div className="w-32 flex-shrink-0 p-3 border-r border-border/50 bg-muted/10 flex items-center">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hab.</span>
                        </div>
                        <div className="flex-1 flex">
                            {days.map(day => {
                                const isToday = isSameDay(day, new Date());
                                return (
                                    <div key={day.toISOString()} className={cn("flex-1 min-w-[60px] border-r border-border/50 p-2 flex flex-col items-center justify-center", isToday ? "bg-primary/5" : "")}>
                                        <span className={cn("text-[10px] uppercase font-bold", isToday ? "text-primary" : "text-muted-foreground")}>
                                            {format(day, 'EEE', { locale: es })}
                                        </span>
                                        <span className={cn("text-sm font-bold mt-0.5", isToday ? "text-primary" : "text-foreground")}>
                                            {format(day, 'dd')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Body Rows (Rooms) */}
                    <div className="flex flex-col">
                        {pisosOrdenados.map(piso => (
                            <React.Fragment key={piso}>
                                {/* Piso Header */}
                                <div className="bg-muted/30 border-b border-border/50 p-1.5 px-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{piso === 'Sin Piso' ? 'Sin Asignar' : `Piso ${piso}`}</span>
                                </div>
                                {/* Habitaciones del Piso */}
                                {habitacionesAgrupadas[piso].map(hab => (
                                    <div key={hab.id} className="flex border-b border-border/30 group hover:bg-muted/10 transition-colors h-12">
                                        <div className="w-32 flex-shrink-0 p-3 border-r border-border/50 flex flex-col justify-center bg-card group-hover:bg-transparent transition-colors">
                                            <span className="text-sm font-bold">{hab.numero}</span>
                                        </div>
                                        <div className="flex-1 flex relative">
                                            {days.map((day, i) => {
                                                const reserva = getReservaForDay(hab.id, day);
                                                const isToday = isSameDay(day, new Date());
                                                
                                                let isStart = false;
                                                let isEnd = false;
                                                let renderBlock = false;

                                                if (reserva) {
                                                    const rStart = new Date(reserva.fecha_entrada);
                                                    const rEnd = new Date(reserva.fecha_salida);
                                                    isStart = isSameDay(day, rStart);
                                                    isEnd = isSameDay(addDays(day, 1), rEnd) || isSameDay(day, rEnd); // if next day is end, or same day is end (1 night)
                                                    
                                                    // Solo renderizamos el contenido del bloque si es el inicio o es el primer día visible en el timeline
                                                    renderBlock = isStart || i === 0;
                                                }

                                                return (
                                                    <div key={day.toISOString()} className={cn(
                                                        "flex-1 min-w-[60px] border-r border-border/50 p-1 relative",
                                                        isToday && !reserva ? "bg-primary/5" : ""
                                                    )}>
                                                        {reserva && (
                                                            <div 
                                                                title={`${reserva.huesped_nombre} (${reserva.estado})`}
                                                                className={cn(
                                                                    "absolute top-1.5 bottom-1.5 left-0 right-0 z-0 bg-gradient-to-r opacity-90 shadow-sm flex items-center overflow-hidden cursor-pointer hover:opacity-100",
                                                                    avatarColors[reserva.estado] || 'from-gray-500 to-gray-600',
                                                                    isStart ? "rounded-l-md ml-1" : "-ml-[1px]", // overlap border
                                                                    isEnd ? "rounded-r-md mr-1" : "-mr-[1px]"
                                                                )}
                                                            >
                                                                {renderBlock && (
                                                                    <span className="text-[10px] font-bold text-white px-2 truncate relative z-10 drop-shadow-md">
                                                                        {reserva.huesped_nombre}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecepcionTimeline;
