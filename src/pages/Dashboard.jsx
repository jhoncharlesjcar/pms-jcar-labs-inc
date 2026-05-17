import { useQuery } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/use-hotel-data';
import { BedDouble, CheckCircle2, CalendarDays, User, TrendingUp, Receipt, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Componente de Animación: Contador numérico entero
function Counter({ from = 0, to, duration = 1.5 }) {
    const count = useMotionValue(from);
    const rounded = useTransform(count, (latest) => Math.round(latest));

    useEffect(() => {
        const controls = animate(count, to, { duration, ease: 'easeOut' });
        return controls.stop;
    }, [count, to, duration]);

    return <motion.span>{rounded}</motion.span>;
}

// Componente de Animación: Contador de Moneda
function MoneyCounter({ from = 0, to, duration = 1.5 }) {
    const count = useMotionValue(from);
    const formatted = useTransform(count, (latest) => latest.toFixed(2));

    useEffect(() => {
        const controls = animate(count, to, { duration, ease: 'easeOut' });
        return controls.stop;
    }, [count, to, duration]);

    return <motion.span>{formatted}</motion.span>;
}

export default function Dashboard() {
    const { db: hotelDb, hotelId } = useHotelData();

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const habitacionesOrdenadas = [...habitaciones].sort((a, b) => {
        const pisoA = parseInt(a.piso, 10);
        const pisoB = parseInt(b.piso, 10);
        const hasPisoA = !isNaN(pisoA);
        const hasPisoB = !isNaN(pisoB);
        
        if (hasPisoA && hasPisoB) {
            if (pisoA !== pisoB) return pisoA - pisoB;
        } else if (hasPisoA) {
            return -1;
        } else if (hasPisoB) {
            return 1;
        }

        const numA = parseInt(a.numero, 10);
        const numB = parseInt(b.numero, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.numero).localeCompare(String(b.numero));
    });

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    const { data: ventas = [] } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [] } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list('-created_date'),
        enabled: !!hotelId,
    });

    const disponibles = habitaciones.filter(h => h.estado === 'disponible').length;
    const ocupadas = habitaciones.filter(h => h.estado === 'ocupada').length;
    const reservasActivas = reservas.filter(r => r.estado === 'activa').length;
    const mantenimiento = habitaciones.filter(h => h.estado === 'mantenimiento').length;
    const limpieza = habitaciones.filter(h => h.estado === 'limpieza').length;
    const reservadas = habitaciones.filter(h => h.estado === 'reservada').length;

    const hoy = new Date().toLocaleDateString('sv-SE');
    
    // Combinar todas las ventas para el cálculo de ingresos
    const todasLasVentas = [
        ...ventas.map(v => ({ ...v, _tipo: 'hotel' })),
        ...ventasPOS.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta }))
    ];

    const ventasHoy = todasLasVentas.filter(v => {
        const f = (v.fecha_pago || v.fecha_venta || '').split('T')[0];
        return f === hoy;
    });
    const ingresoHoy = ventasHoy.reduce((s, v) => s + Number(v.total || 0), 0);
    const ingresoMes = todasLasVentas.reduce((s, v) => s + Number(v.total || 0), 0);

    const ingresoHotelHoy = ventasHoy.filter(v => v._tipo === 'hotel').reduce((s, v) => s + Number(v.total || 0), 0);
    const ingresoPOSHoy = ventasHoy.filter(v => v._tipo === 'pos').reduce((s, v) => s + Number(v.total || 0), 0);

    const ingresoHotelTotal = ventas.reduce((s, v) => s + Number(v.total || 0), 0);
    const ingresoPOSTotal = ventasPOS.reduce((s, v) => s + Number(v.total || 0), 0);

    const ocupacionPct = habitaciones.length > 0 ? Math.round(((ocupadas + limpieza) / habitaciones.length) * 100) : 0;
    

    // Color de la barra según ocupación
    const barColor = ocupacionPct > 80 ? 'from-red-500 to-red-400' : ocupacionPct > 50 ? 'from-amber-500 to-yellow-400' : 'from-primary to-emerald-400';

    const mainStats = [
        { label: 'Ocupación', value: ocupacionPct, unit: '%', icon: BedDouble, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        { label: 'Hoy', value: ingresoHoy, unit: 'S/', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isMoney: true },
        { label: 'Libres', value: disponibles, unit: '', icon: CheckCircle2, color: 'text-amber-500', bg: 'bg-amber-500/10' },
        { label: 'Reservas', value: reservasActivas, unit: '', icon: User, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    ];

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-10">
            {/* Header con Contexto */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                    <h1 className="font-display text-2xl sm:text-4xl font-black text-foreground tracking-tight">Dashboard</h1>
                    <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <CalendarDays className="w-4 h-4" />
                        <p className="text-sm font-medium capitalize">
                            {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                </motion.div>
                <div className="flex gap-2">
                    <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Sistema Online</span>
                    </div>
                </div>
            </div>

            {/* Main KPIs Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {mainStats.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <motion.div
                            key={s.label}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.1, duration: 0.5 }}
                            className="glass-card group relative p-4 sm:p-7 rounded-[1.5rem] sm:rounded-[2.5rem] hover:border-primary/40 transition-all duration-500 overflow-hidden"
                        >
                            <div className="relative z-10">
                                <div className="flex items-center justify-between mb-6">
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-lg group-hover:shadow-primary/20 group-hover:rotate-6",
                                        s.bg
                                    )}>
                                        <Icon className={cn("w-7 h-7", s.color)} />
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-1">{s.label}</p>
                                        <div className="flex items-baseline justify-end gap-1">
                                            {s.isMoney && <span className="text-[10px] sm:text-base font-black text-muted-foreground/50">S/</span>}
                                            <p className="text-xl sm:text-3xl font-black text-foreground tracking-tighter">
                                                {s.isMoney ? <MoneyCounter to={s.value} /> : <Counter to={s.value} />}
                                                <span className="text-xs sm:text-lg ml-0.5">{!s.isMoney && s.unit}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden p-0.5 border border-border/5">
                                    <motion.div 
                                        initial={{ width: 0 }} 
                                        animate={{ width: '100%' }} 
                                        transition={{ duration: 2.5, delay: 0.5, ease: "circOut" }}
                                        className={cn("h-full rounded-full opacity-60", s.color.replace('text-', 'bg-'))} 
                                    />
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-primary/10 transition-colors" />
                        </motion.div>
                    );
                })}
            </div>

            {/* Ocupación + Distribución de Ingresos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Ocupación Avanzado (Premium Styling) */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    className="lg:col-span-2 glass-card rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 relative overflow-hidden group"
                >
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-10">
                            <div>
                                <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl">
                                        <BedDouble className="w-6 h-6 text-primary" />
                                    </div>
                                    Ocupación
                                </h3>
                                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase tracking-widest">Estado real del inventario</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl shadow-sm">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                                    {disponibles} Habitaciones Disponibles
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                            <div className="space-y-8">
                                <div className="relative">
                                    <div className="flex justify-between items-end mb-4">
                                        <div className="flex items-baseline gap-2">
                                            <p className="text-6xl font-black text-foreground leading-none tracking-tighter italic">
                                                <Counter to={ocupacionPct} />
                                            </p>
                                            <span className="text-2xl font-black text-primary">%</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{ocupadas + limpieza} en uso total</p>
                                    </div>
                                    <div className="w-full h-6 bg-muted rounded-full overflow-hidden p-1.5 border border-border/20 shadow-inner">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${ocupacionPct}%` }}
                                            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
                                            className={cn("h-full rounded-full bg-gradient-to-r shadow-lg shadow-primary/20", barColor)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {[
                                        { label: 'Libres', val: disponibles, color: 'emerald' },
                                        { label: 'Ocupadas', val: ocupadas, color: 'blue' },
                                        { label: 'Limpieza', val: limpieza, color: 'purple' },
                                        { label: 'Mantenim.', val: mantenimiento, color: 'amber' }
                                    ].map((item) => (
                                        <div key={item.label} className="p-5 bg-card/40 border border-border/20 rounded-[1.5rem] hover:scale-105 transition-transform">
                                            <p className={cn("text-[9px] font-black uppercase mb-1.5 tracking-[0.2em]", `text-${item.color}-600`)}>{item.label}</p>
                                            <p className="text-2xl font-black text-foreground tracking-tight">{item.val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mapa Visual con Efecto Glass */}
                            <div className="hidden md:grid grid-cols-4 gap-3">
                                {habitacionesOrdenadas.slice(0, 16).map((h, i) => (
                                    <motion.div 
                                        key={h.id}
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: i * 0.03 }}
                                        className={cn(
                                            "aspect-square rounded-xl border border-white/5 shadow-md flex items-center justify-center transition-all group/cell",
                                            h.estado === 'disponible' ? 'bg-emerald-500/20 hover:bg-emerald-500' :
                                            h.estado === 'ocupada' ? 'bg-primary/40 hover:bg-primary' : 'bg-amber-500/20 hover:bg-amber-500'
                                        )}
                                    >
                                        <span className="text-[10px] font-black text-white/40 group-hover/cell:text-white transition-colors">{h.numero}</span>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Distribución de Ingresos (Premium Chart Style) */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 flex flex-col group overflow-hidden"
                >
                    <div className="flex items-center justify-between mb-10">
                        <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                            <div className="p-2 bg-emerald-500/10 rounded-xl">
                                <TrendingUp className="w-6 h-6 text-emerald-500" />
                            </div>
                            Ingresos Diarios
                        </h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center space-y-10">
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-6 bg-primary rounded-full" />
                                    <span className="text-[11px] font-black text-foreground uppercase tracking-widest">Hospedaje</span>
                                </div>
                                <span className="text-lg font-black text-foreground">S/ {ingresoHotelHoy.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-border/10 shadow-inner">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: ingresoHoy > 0 ? `${(ingresoHotelHoy/ingresoHoy)*100}%` : '0%' }}
                                    transition={{ duration: 1.5, ease: "circOut" }}
                                    className="h-full bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.4)]" 
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-6 bg-secondary rounded-full" />
                                    <span className="text-[11px] font-black text-foreground uppercase tracking-widest">Tienda (POS)</span>
                                </div>
                                <span className="text-lg font-black text-foreground">S/ {ingresoPOSHoy.toFixed(2)}</span>
                            </div>
                            <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5 border border-border/10 shadow-inner">
                                <motion.div 
                                    initial={{ width: 0 }} 
                                    animate={{ width: ingresoHoy > 0 ? `${(ingresoPOSHoy/ingresoHoy)*100}%` : '0%' }}
                                    transition={{ duration: 1.5, ease: "circOut" }}
                                    className="h-full bg-secondary rounded-full shadow-[0_0_15px_rgba(var(--secondary),0.4)]" 
                                />
                            </div>
                        </div>

                        <div className="pt-10 mt-auto border-t border-border/10">
                            <div className="flex items-center justify-between mb-6">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Cierre Estimado</p>
                                <span className="px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-black rounded-lg">Real Time</span>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-4 bg-background/40 rounded-2xl border border-border/20">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Acumulado Mes</p>
                                    <p className="text-xl font-black text-foreground">S/ {ingresoMes.toLocaleString()}</p>
                                </div>
                                <div className="p-4 bg-background/40 rounded-2xl border border-border/20">
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Tickets POS</p>
                                    <p className="text-xl font-black text-foreground">{ventasPOS.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-0 right-0 w-40 h-40 bg-secondary/5 blur-[80px] rounded-full translate-y-1/2 translate-x-1/2 group-hover:bg-secondary/10 transition-colors" />
                </motion.div>
            </div>

            {/* Últimas Ventas Feed (Premium List) */}
            <motion.div
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 mt-8"
            >
                <div className="flex items-center justify-between mb-10">
                    <div>
                        <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                <Receipt className="w-6 h-6" />
                            </div>
                            Actividad Reciente
                        </h3>
                        <p className="text-xs text-muted-foreground font-bold mt-1 uppercase tracking-widest">Últimos movimientos financieros</p>
                    </div>
                    <Link to="/ventas">
                        <Button variant="ghost" className="text-[10px] font-black text-primary uppercase tracking-[0.2em] gap-2 hover:bg-primary/10 rounded-2xl px-6 h-12 border border-primary/10 transition-all active:scale-95">
                            Ver Todo <ChevronRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {todasLasVentas
                        .sort((a, b) => new Date(b.fecha_pago || b.fecha_venta).getTime() - new Date(a.fecha_pago || a.fecha_venta).getTime())
                        .slice(0, 5)
                        .map((v, i) => (
                        <motion.div
                            key={`${v._tipo}-${v.id}`}
                            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.05 }}
                            className="flex items-center justify-between p-4 sm:p-6 bg-card/20 hover:bg-card/60 border border-border/10 hover:border-primary/20 rounded-2xl sm:rounded-3xl transition-all group cursor-default shadow-sm hover:shadow-xl"
                        >
                            <div className="flex items-center gap-6">
                                <div className={cn(
                                    "w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg group-hover:rotate-6",
                                    v._tipo === 'pos' ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-primary text-white shadow-primary/20"
                                )}>
                                    <Receipt className="w-5 h-5 sm:w-7 sm:h-7" />
                                </div>
                                <div>
                                    <p className="text-sm sm:text-base font-black text-foreground flex items-center gap-2 sm:gap-3 tracking-tight">
                                        {v.huesped_nombre || 'Cliente Final'} 
                                        {v._tipo === 'pos' && (
                                            <span className="text-[9px] bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full uppercase font-black tracking-widest border border-amber-500/20">
                                                Tienda
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-bold mt-1 tracking-tight flex items-center gap-2">
                                        <span className="opacity-50">#{v.numero_ticket}</span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span>{v.habitacion_numero ? `Suite ${v.habitacion_numero}` : 'Venta Express'}</span>
                                        <span className="w-1 h-1 rounded-full bg-border" />
                                        <span className="text-primary/70">{new Date(v.fecha_pago || v.fecha_venta).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-black text-foreground tracking-tight italic">S/ {Number(v.total || 0).toFixed(2)}</p>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-secondary/10 border border-secondary/20 rounded-lg mt-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                                    <p className="text-[9px] text-secondary font-black uppercase tracking-widest">{v.metodo_pago}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                    {todasLasVentas.length === 0 && (
                        <div className="text-center py-24 bg-secondary/5 rounded-[2.5rem] border border-dashed border-border/50">
                            <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Receipt className="w-10 h-10 text-muted-foreground/30" />
                            </div>
                            <p className="text-sm font-black text-muted-foreground/60 uppercase tracking-[0.4em]">Sin movimientos registrados hoy</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}