import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, CalendarDays, User, CheckCircle2, Wrench, Sparkles, XCircle, LogIn, MapPin, Users as UsersIcon, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { differenceInDays, format, addDays } from 'date-fns';
import RegistrarVentaModal from '@/components/RegistrarVentaModal';
import { useHotelData } from '@/hooks/use-hotel-data';
import { motion, AnimatePresence } from 'framer-motion';

const estadoBadge = {
    pendiente: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    activa: 'bg-primary/10 text-primary',
    finalizada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const roomStatusConfig = {
    disponible: {
        label: 'Disponible',
        icon: CheckCircle2,
        color: 'text-[hsl(var(--state-disponible-fg))]',
        bg: 'bg-[hsl(var(--state-disponible-bg))] border-[hsl(var(--state-disponible-border))]'
    },
    ocupada: {
        label: 'Ocupada',
        icon: User,
        color: 'text-[hsl(var(--state-ocupada-fg))]',
        bg: 'bg-[hsl(var(--state-ocupada-bg))] border-[hsl(var(--state-ocupada-border))]'
    },
    reservada: {
        label: 'Reservada',
        icon: CalendarDays,
        color: 'text-[hsl(var(--state-reservada-fg))]',
        bg: 'bg-[hsl(var(--state-reservada-bg))] border-[hsl(var(--state-reservada-border))]'
    },
    mantenimiento: {
        label: 'Mantenimiento',
        icon: Wrench,
        color: 'text-[hsl(var(--state-mantenimiento-fg))]',
        bg: 'bg-[hsl(var(--state-mantenimiento-bg))] border-[hsl(var(--state-mantenimiento-border))]'
    },
    limpieza: {
        label: 'Limpieza',
        icon: Sparkles,
        color: 'text-[hsl(var(--state-limpieza-fg))]',
        bg: 'bg-[hsl(var(--state-limpieza-bg))] border-[hsl(var(--state-limpieza-border))]'
    },
};

const emptyForm = {
    habitacion_id: '', habitacion_numero: '', habitacion_tipo: '',
    huesped_nombre: '', huesped_dni: '', huesped_telefono: '', huesped_procedencia: '',
    nacionalidad: 'Peruana', motivo_viaje: 'turismo',
    fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
    fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    noches: 1, precio_noche: 0, total: 0,
    num_adultos: 1, num_ninos: 0, observaciones: '', estado: 'activa',
};

export default function Recepcion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [open, setOpen] = useState(false);
    const [ventaModal, setVentaModal] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState('activa');

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const { data: ventas = [] } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [] } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list(),
        enabled: !!hotelId,
    });

    const saveReserva = useMutation({
        /** @param {any} data */
        mutationFn: async (data) => {
            const nueva = await hotelDb.Reserva.create({
                ...data,
                numero_reserva: `R${Date.now().toString().slice(-6)}`,
            });

            if (nueva.habitacion_id) {
                await hotelDb.Habitacion.update(nueva.habitacion_id, {
                    estado: nueva.estado === 'activa' ? 'ocupada' : 'reservada'
                });
            }
            return nueva;
        },
        onSuccess: (nueva) => {
            qc.invalidateQueries({ queryKey: ['reservas'] });
            qc.invalidateQueries({ queryKey: ['habitaciones'] });
            setOpen(false);
            if (nueva.estado === 'activa') {
                setVentaModal(nueva);
            }
            setForm(emptyForm);
        },
    });

    const actualizarEstado = useMutation({
        /** @param {any} params */
        mutationFn: ({ id, estado, hab_id }) => {
            const updates = [hotelDb.Reserva.update(id, { estado })];
            if (hab_id && estado === 'finalizada') {
                updates.push(hotelDb.Habitacion.update(hab_id, { estado: 'disponible' }));
            }
            return Promise.all(updates);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservas'] }); qc.invalidateQueries({ queryKey: ['habitaciones'] }); },
    });

    // Auto-calculo de noches y total
    useEffect(() => {
        if (form.fecha_entrada && form.fecha_salida) {
            const diff = differenceInDays(new Date(form.fecha_salida), new Date(form.fecha_entrada));
            const n = diff > 0 ? diff : 1;
            setForm(prev => ({
                ...prev,
                noches: n,
                total: n * prev.precio_noche
            }));
        }
    }, [form.fecha_entrada, form.fecha_salida, form.precio_noche]);

    const seleccionarHab = (hab) => {
        const diff = differenceInDays(new Date(form.fecha_salida), new Date(form.fecha_entrada));
        const n = diff > 0 ? diff : 1;
        setForm({
            ...form,
            habitacion_id: hab.id,
            habitacion_numero: hab.numero,
            habitacion_tipo: hab.tipo,
            precio_noche: hab.precio_noche,
            noches: n,
            total: hab.precio_noche * n,
        });
    };

    const filtradas = reservas.filter(r => {
        if (filtro !== 'todas' && r.estado !== filtro) return false;
        if (!busqueda) return true;
        const b = busqueda.toLowerCase();
        return (
            r.huesped_nombre?.toLowerCase().includes(b) ||
            r.habitacion_numero?.toLowerCase().includes(b) ||
            r.huesped_dni?.toLowerCase().includes(b)
        );
    }).sort((a, b) => new Date(b.fecha_entrada).getTime() - new Date(a.fecha_entrada).getTime());

    const habitacionesDisp = habitaciones
        .filter(h => h.estado === 'disponible')
        .sort((a, b) => {
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

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">Recepción</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Entradas, salidas y reservas</p>
                </div>
                <Button onClick={() => setOpen(true)} className="w-full sm:w-auto gap-2 shadow-lg hover:shadow-primary/20 transition-all h-11 sm:h-12 rounded-xl text-xs sm:text-sm font-black">
                    <Plus className="w-4 h-4" /> Nueva Reserva
                </Button>
            </div>

            {/* Filtros y Búsqueda */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                        placeholder="Huésped, DNI o Habitación..."
                        className="pl-11 bg-card/50 backdrop-blur-sm border-border/50 h-11 rounded-xl text-sm"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <div className="flex gap-1.5 p-1 bg-secondary/10 rounded-xl border border-border/50 overflow-x-auto scrollbar-hide">
                    {['todas', 'pendiente', 'activa', 'finalizada'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltro(f)}
                            className={cn(
                                "px-4 py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                                filtro === f ? "bg-background text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista de Reservas */}
            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {filtradas.map(r => {
                        const initials = (r.huesped_nombre || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                        const avatarColors = {
                            activa: 'from-primary to-primary/70',
                            pendiente: 'from-orange-500 to-amber-500',
                            finalizada: 'from-green-500 to-emerald-500',
                            cancelada: 'from-red-500 to-rose-500',
                        };
                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                key={r.id}
                                className="bg-card/40 backdrop-blur-xl rounded-[1.5rem] sm:rounded-[2rem] border border-border/50 p-4 sm:p-6 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 group"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-3 sm:gap-4">
                                        <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg bg-gradient-to-br text-white font-black text-xs sm:text-sm", avatarColors[r.estado] || 'from-gray-500 to-gray-600')}>
                                            {initials}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-sm sm:text-lg text-foreground tracking-tight">{r.huesped_nombre}</p>
                                                <span className={cn("text-[8px] sm:text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-black border", estadoBadge[r.estado])}>
                                                    {r.estado}
                                                </span>
                                            </div>
                                            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
                                                Hab. {r.habitacion_numero} · {r.noches} {r.noches === 1 ? 'noche' : 'noches'}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground/80 mt-1 flex items-center gap-1">
                                                <CalendarDays className="w-3 h-3" />
                                                {format(new Date(r.fecha_entrada), "dd/MM")} → {format(new Date(r.fecha_salida), "dd/MM")} · DNI: {r.huesped_dni || 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border/10">
                                        <div className="text-left sm:text-right">
                                            <p className="text-xl sm:text-2xl font-display font-black text-foreground tracking-tight">S/ {r.total?.toFixed(2)}</p>
                                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5 opacity-60">#{r.numero_reserva}</p>
                                        </div>
                                        <div className="w-px h-10 bg-border/50 hidden sm:block" />
                                        <div className="flex gap-1.5">
                                            {r.estado === 'activa' && (
                                                <Button size="sm" variant="default" className="gap-1.5 shadow-lg shadow-primary/10 rounded-xl h-9 text-[10px] sm:text-xs font-black uppercase tracking-tight px-3"
                                                    onClick={() => {
                                                        const pagado = ventas.some(v => v.reserva_id === r.id) || ventasPOS.some(v => v.reserva_id === r.id);
                                                        
                                                        if (!pagado) {
                                                            if (!confirm('⚠️ ALERTA: No se detecta un pago registrado. ¿Cobrar ahora?')) return;
                                                            setVentaModal(r);
                                                            return;
                                                        }
 
                                                        if (confirm('¿Finalizar estadía?')) {
                                                            actualizarEstado.mutate({ id: r.id, estado: 'finalizada', hab_id: r.habitacion_id });
                                                        }
                                                    }}>
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Check-out
                                                </Button>
                                            )}
                                            {r.estado === 'pendiente' && (
                                                <Button size="sm" variant="default" className="gap-1.5 shadow-lg shadow-primary/10 rounded-xl h-9 text-[10px] sm:text-xs font-black uppercase tracking-tight px-4"
                                                    onClick={() => {
                                                        actualizarEstado.mutate({ id: r.id, estado: 'activa', hab_id: r.habitacion_id });
                                                        setVentaModal(r);
                                                    }}>
                                                    <LogIn className="w-3.5 h-3.5" /> Check-in
                                                </Button>
                                            )}
                                            {(r.estado === 'pendiente' || r.estado === 'activa') && (
                                                <Button size="sm" variant="ghost" className="text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-xl w-9 h-9 p-0"
                                                    onClick={() => { if (confirm('¿Cancelar reserva?')) actualizarEstado.mutate({ id: r.id, estado: 'cancelada', hab_id: r.habitacion_id }); }}>
                                                    <XCircle className="w-4.5 h-4.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {filtradas.length === 0 && (
                    <div className="text-center py-24 bg-card/30 backdrop-blur-xl rounded-[2rem] border border-dashed border-border/50">
                        <CalendarDays className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <p className="text-lg font-bold text-muted-foreground">No se encontraron reservas</p>
                        <p className="text-sm text-muted-foreground/60 mt-1">Prueba con otro filtro o término de búsqueda</p>
                    </div>
                )}
            </div>

            {/* Modal nueva reserva (FULL FORM) */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl bg-card/95 backdrop-blur-3xl border-border/50 shadow-2xl rounded-[2.5rem] p-0 overflow-hidden">
                    <div className="h-[90vh] flex flex-col">
                        <DialogHeader className="p-5 sm:p-8 pb-0">
                            <DialogTitle className="font-display text-2xl sm:text-3xl font-black text-foreground">Registro de Reserva</DialogTitle>
                            <p className="text-muted-foreground text-[10px] sm:text-sm font-medium uppercase tracking-widest mt-1">Completa el registro oficial</p>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-5 sm:p-8 pt-6 space-y-6 sm:space-y-8 custom-scrollbar">
                            {/* Sección 1: Selección de Habitación */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">1. Selección de Habitación</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                    {habitacionesDisp.map(h => (
                                        <button key={h.id} onClick={() => seleccionarHab(h)}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group h-24 flex flex-col justify-center",
                                                form.habitacion_id === h.id
                                                    ? "border-primary bg-primary/5 shadow-inner"
                                                    : "border-border/50 bg-background/50 hover:border-primary/50 hover:bg-background"
                                            )}>
                                            <p className="font-black text-xl leading-none">#{h.numero}</p>
                                            <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tight mt-1 truncate">{h.tipo}</p>
                                            <p className="text-xs font-bold text-primary mt-1">S/{h.precio_noche}</p>
                                            {form.habitacion_id === h.id && (
                                                <motion.div layoutId="selection-glow" className="absolute inset-0 bg-primary/5 -z-0" />
                                            )}
                                        </button>
                                    ))}
                                    {habitacionesDisp.length === 0 && <p className="col-span-full py-6 text-center text-sm text-muted-foreground bg-secondary/10 rounded-2xl border border-dashed border-border">No hay habitaciones disponibles</p>}
                                </div>
                            </div>

                            {/* Sección 2: Datos del Huésped */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">2. Información del Huésped</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <div className="md:col-span-2 space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre Completo</Label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input value={form.huesped_nombre} onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} placeholder="Ej: Juan Pérez" className="pl-11 bg-background/50 h-12 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">DNI / Documento</Label>
                                        <Input value={form.huesped_dni} onChange={e => setForm({ ...form, huesped_dni: e.target.value })} placeholder="Número de DNI" className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono</Label>
                                        <Input value={form.huesped_telefono} onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} placeholder="Ej: 987654321" className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Procedencia</Label>
                                        <div className="relative">
                                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input value={form.huesped_procedencia} onChange={e => setForm({ ...form, huesped_procedencia: e.target.value })} placeholder="Ciudad/País" className="pl-11 bg-background/50 h-12 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Registro</Label>
                                        <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                            <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="activa">Check-in (Entrada Inmediata)</SelectItem>
                                                <SelectItem value="pendiente">Reserva (Pendiente)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nacionalidad</Label>
                                        <Input value={form.nacionalidad} onChange={e => setForm({ ...form, nacionalidad: e.target.value })} placeholder="Ej: Peruana" className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Motivo de Viaje</Label>
                                        <Select value={form.motivo_viaje} onValueChange={v => setForm({ ...form, motivo_viaje: v })}>
                                            <SelectTrigger className="h-12 bg-background/50 rounded-xl"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                <SelectItem value="turismo">Turismo / Recreación</SelectItem>
                                                <SelectItem value="negocios">Negocios / Trabajo</SelectItem>
                                                <SelectItem value="estudios">Estudios / Capacitación</SelectItem>
                                                <SelectItem value="salud">Salud / Tratamiento</SelectItem>
                                                <SelectItem value="otros">Otros</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 3: Fechas y Estancia */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">3. Fechas y Estancia</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Entrada</Label>
                                        <Input type="date" value={form.fecha_entrada} onChange={e => setForm({ ...form, fecha_entrada: e.target.value })} className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Salida</Label>
                                        <Input type="date" value={form.fecha_salida} onChange={e => setForm({ ...form, fecha_salida: e.target.value })} className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Noches</Label>
                                        <Input type="number" readOnly value={form.noches} className="bg-secondary/30 h-12 rounded-xl font-bold text-center" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Total a Pagar</Label>
                                        <div className="h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center px-4">
                                            <span className="text-lg font-black text-primary italic">S/ {form.total?.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sección 4: Detalles Adicionales */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1 h-4 bg-primary rounded-full" />
                                    <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">4. Detalles Adicionales</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Adultos</Label>
                                        <div className="relative">
                                            <UsersIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <Input type="number" min={1} value={form.num_adultos} onChange={e => setForm({ ...form, num_adultos: Number(e.target.value) })} className="pl-11 bg-background/50 h-12 rounded-xl" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Niños</Label>
                                        <Input type="number" min={0} value={form.num_ninos} onChange={e => setForm({ ...form, num_ninos: Number(e.target.value) })} className="bg-background/50 h-12 rounded-xl" />
                                    </div>
                                    <div className="md:col-span-3 space-y-2">
                                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Observaciones</Label>
                                        <div className="relative">
                                            <Info className="absolute left-4 top-4 w-4 h-4 text-muted-foreground" />
                                            <textarea
                                                value={form.observaciones}
                                                onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                                placeholder="Cualquier detalle especial..."
                                                className="w-full pl-11 pr-4 py-3 bg-background/50 border border-border/50 rounded-2xl min-h-[100px] focus:outline-none focus:border-primary/50 transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer con Botones */}
                        <div className="p-5 sm:p-8 bg-background/40 border-t border-border/50 flex flex-col sm:flex-row gap-3">
                            <Button variant="outline" className="h-12 sm:h-14 rounded-2xl text-sm font-bold border-border/50 hover:bg-secondary order-2 sm:order-1" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button className="flex-1 h-12 sm:h-14 rounded-2xl text-sm sm:text-base font-black shadow-2xl shadow-primary/30 order-1 sm:order-2"
                                onClick={() => {
                                    if (form.huesped_dni && form.huesped_dni.length !== 8 && form.huesped_dni.length !== 11 && form.huesped_dni.length !== 12) {
                                        alert('El documento ingresado no tiene un formato válido (DNI 8, RUC 11, CE 12)');
                                        return;
                                    }
                                    saveReserva.mutate(form);
                                }}
                                disabled={saveReserva.isPending || !form.habitacion_id || !form.huesped_nombre}>
                                {saveReserva.isPending ? 'Procesando...' : 'Finalizar Registro'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {ventaModal && (
                <RegistrarVentaModal
                    reserva={ventaModal}
                    onClose={() => setVentaModal(null)}
                    onSuccess={() => {
                        setVentaModal(null);
                    }}
                />
            )}
        </motion.div>
    );
}