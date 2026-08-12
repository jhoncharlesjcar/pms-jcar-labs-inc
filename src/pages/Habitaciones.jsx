// @ts-nocheck
import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BedDouble, Wrench, CheckCircle2, CalendarDays, User, Sparkles, Pencil, Trash2, Wifi, Tv, Droplets, Bath } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { useHotelData } from '@/hooks/use-hotel-data';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { TIPOS_HABITACION, filtrarPorEstado, formatearHabitacionParaBD, validarHabitacion, puedeEliminarHabitacion } from '@/services/habitaciones.service';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageSkeleton from '@/components/loaders/PageSkeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/common/EmptyState';

const estadoConfig = {
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

const tiposHab = TIPOS_HABITACION;

const empty = { numero: '', tipo: 'simple', precio: 0, precio_noche: 0, capacidad: 1, piso: '', descripcion: '', estado: 'disponible' };

const AMENITIES_MAP = [
    { id: 'wifi', label: 'WiFi', icon: Wifi },
    { id: 'tv', label: 'Smart TV', icon: Tv },
    { id: 'agua', label: 'Agua Caliente', icon: Droplets },
    { id: 'bano', label: 'Baño Privado', icon: Bath },
];

const parseAmenities = (desc) => {
    try {
        const parsed = JSON.parse(desc);
        if (parsed && typeof parsed === 'object') return parsed;
    } catch {
        const text = desc || '';
        return {
            wifi: text.toLowerCase().includes('wifi'),
            tv: text.toLowerCase().includes('tv') || text.toLowerCase().includes('smart'),
            agua: text.toLowerCase().includes('agua'),
            bano: text.toLowerCase().includes('baño') || text.toLowerCase().includes('privado')
        };
    }
    return { wifi: false, tv: false, agua: false, bano: false };
};

const Habitaciones = memo(function Habitaciones() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(empty);
    const [amenities, setAmenities] = useState({ wifi: false, tv: false, agua: false, bano: false });
    const [editId, setEditId] = useState(null);
    const [filtroEstado, setFiltroEstado] = useState('todos');

    const [deleteTarget, setDeleteTarget] = useState(null);

    const { data: habitaciones = [], isLoading } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    // Stagger 2D wave para el grid de habitaciones (4 columnas en desktop)
    const gridRef = useGsapStaggerList([filtroEstado, habitaciones.length], {
        stagger: 0.05,
        direction: 'y',
        distance: 12,
        grid: 'auto',
        from: 'start',
    });

    const save = useMutation({
        /** @param {any} data */
        mutationFn: (data) => editId ? hotelDb.Habitacion.update(editId, data) : hotelDb.Habitacion.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] }); setOpen(false); setForm(empty); setEditId(null); },
    });

    // Query optimizada: solo carga reservas activas/pendientes con columnas mínimas
    const { data: reservasActivas = [] } = useQuery({
        queryKey: ['reservas-activas-habitacion', hotelId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('reservas')
                .select('id, habitacion_id, estado')
                .in('estado', ['activa', 'pendiente'])
                .eq('hotel_id', hotelId);
            if (error) throw error;
            return data || [];
        },
        enabled: !!hotelId,
        staleTime: 1000 * 30, // 30 segundos
    });

    const del = useMutation({
        /** @param {any} id */
        mutationFn: (id) => hotelDb.Habitacion.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['habitaciones', hotelId] });
            setDeleteTarget(null);
            toast.success("Habitación eliminada correctamente.");
        },
    });

    const openEdit = (h) => { 
        const precioVal = h.precio_noche ?? h.precio ?? 0;
        setForm({ ...h, precio: precioVal, precio_noche: precioVal }); 
        setEditId(h.id); 
        setAmenities(parseAmenities(h.descripcion)); 
        setOpen(true); 
    };
    const openNew = () => { setForm(empty); setEditId(null); setAmenities({ wifi: false, tv: false, agua: false, bano: false }); setOpen(true); };

    const handleSave = () => {
        const precioFinal = Number(form.precio_noche) || Number(form.precio) || 0;

        // 1. Validar datos con el service
        const validation = validarHabitacion({
            numero: form.numero,
            precio_noche: precioFinal,
            capacidad: Number(form.capacidad) || 1,
            tipo: form.tipo,
        });

        if (!validation.valido) {
            toast.error(validation.errors.join('. '));
            return;
        }

        // 2. Validar duplicado de número
        const isDuplicate = habitaciones.some(
            h => String(h.numero).toLowerCase() === String(form.numero).toLowerCase() && h.id !== editId
        );

        if (isDuplicate) {
            toast.error(`La habitación #${form.numero} ya existe. Por favor, usa un número diferente.`);
            return;
        }

        // 3. Validar límite de habitaciones (Plan Básico: 15 máx)
        const limit = 15;
        if (habitaciones.length >= limit && !editId) {
            toast.error(`Límite del Plan Básico alcanzado (${limit} habitaciones). Por favor, actualiza tu suscripción SaaS para registrar más habitaciones.`);
            return;
        }

        // 4. Construir payload con el service y enviar
        const dataToSave = formatearHabitacionParaBD({
            hotel_id: hotelId,
            numero: form.numero,
            piso: form.piso,
            tipo: form.tipo,
            estado: form.estado || 'disponible',
            precio_noche: precioFinal,
            precio: precioFinal,
            capacidad: Number(form.capacidad) || 1,
            descripcion: JSON.stringify(amenities),
        });
        save.mutate(dataToSave);
    };

    const filtradas = (filtroEstado === 'todos' ? habitaciones : filtrarPorEstado(habitaciones, filtroEstado))
        .sort((a, b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.numero).localeCompare(String(b.numero));
        });

    const agrupadasPorPiso = filtradas.reduce((acc, hab) => {
        const piso = hab.piso?.trim() || 'Sin Piso';
        if (!acc[piso]) acc[piso] = [];
        acc[piso].push(hab);
        return acc;
    }, {});

    const pisosOrdenados = Object.keys(agrupadasPorPiso).sort((a, b) => {
        if (a === 'Sin Piso') return 1;
        if (b === 'Sin Piso') return -1;
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Habitaciones</h1>
                    <p className="text-sm text-muted-foreground mt-1">{habitaciones.length} habitaciones registradas</p>
                </div>
                <div className="w-full sm:w-auto">
                    <Button onClick={openNew} className="w-full sm:w-auto gap-2 shadow-sm h-9 rounded-md text-sm font-medium px-4 transition-transform active:scale-95">
                        <Plus className="w-4 h-4" /> Nueva Habitación
                    </Button>
                </div>
            </div>
            <div className="space-y-3">
                <div className="bg-card p-1.5 rounded-lg border border-border/80 mb-6 sticky top-0 z-10 lg:relative shadow-xs w-full max-w-full overflow-hidden">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide no-scrollbar w-full">
                        <button
                            onClick={() => setFiltroEstado('todos')}
                            className={cn(
                                "flex-none lg:flex-1 min-w-[100px] py-1.5 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 active:scale-95 whitespace-nowrap flex flex-col items-center gap-0.5",
                                filtroEstado === 'todos' ? "bg-primary text-white shadow-xs" : "text-muted-foreground hover:bg-secondary/20"
                            )}
                        >
                            <span className="opacity-70"><BedDouble className="w-3.5 h-3.5" /></span>
                            <span>Todas ({habitaciones.length})</span>
                        </button>
                        {Object.entries(estadoConfig).map(([key, cfg]) => {
                            const count = habitaciones.filter(h => h.estado === key).length;
                            const activeColors = {
                                disponible: "bg-green-600 text-white shadow-xs",
                                ocupada: "bg-red-600 text-white shadow-xs",
                                reservada: "bg-blue-600 text-white shadow-xs",
                                mantenimiento: "bg-amber-600 text-white shadow-xs",
                                limpieza: "bg-purple-600 text-white shadow-xs"
                            };
                            return (
                                <button
                                    key={key}
                                    onClick={() => setFiltroEstado(key)}
                                    className={cn(
                                        "flex-none lg:flex-1 min-w-[100px] py-1.5 px-3 rounded text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 active:scale-95 whitespace-nowrap flex flex-col items-center gap-0.5",
                                        filtroEstado === key ? activeColors[key] : "text-muted-foreground hover:bg-secondary/20"
                                    )}
                                >
                                    <span className="opacity-70"><cfg.icon className="w-3.5 h-3.5" /></span>
                                    <span>{cfg.label} ({count})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Floor Plan View */}
            {isLoading ? (
                <PageSkeleton variant="limpieza" />
            ) : filtradas.length === 0 ? (
                <EmptyState
                    icon={BedDouble}
                    title="No hay habitaciones"
                    description={filtroEstado !== 'todos' ? `No hay habitaciones en estado "${estadoConfig[filtroEstado]?.label || filtroEstado}"` : 'Registra una nueva habitación para comenzar.'}
                    action={filtroEstado !== 'todos' ? null : { label: 'Nueva Habitación', icon: Plus, onClick: openNew }}
                />
            ) : (
                <div ref={gridRef} className="space-y-10">
                    {pisosOrdenados.map((piso) => (
                        <div key={piso} className="space-y-4">
                            {/* Floor Header */}
                            <div className="flex items-center gap-4 py-2 border-b border-border/50 mb-2">
                                <h2 className="text-lg font-display font-bold tracking-tight text-foreground whitespace-nowrap">
                                    {piso === 'Sin Piso' ? 'Sin Asignar' : `Piso ${piso}`}
                                </h2>
                                <div className="h-px bg-border/80 flex-1" />
                                <span className="text-xs font-medium text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
                                    {agrupadasPorPiso[piso].length} habs.
                                </span>
                            </div>

                            {/* Floor Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                                {agrupadasPorPiso[piso].map(h => {
                                    const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
                                    const stateNumberColors = {
                                        disponible: 'text-green-600 dark:text-green-400',
                                        ocupada: 'text-red-600 dark:text-red-400',
                                        reservada: 'text-blue-600 dark:text-blue-400',
                                        mantenimiento: 'text-amber-600 dark:text-amber-400',
                                        limpieza: 'text-purple-600 dark:text-purple-400',
                                    };
                                    const stateIconWrapperColors = {
                                        disponible: 'bg-green-500/10 text-green-600 dark:text-green-400',
                                        ocupada: 'bg-red-500/10 text-red-600 dark:text-red-400',
                                        reservada: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                        mantenimiento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                        limpieza: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                                    };
                                    const StateIcon = cfg.icon;

                                    return (
                                        <div
                                            key={h.id} 
                                            className={cn(
                                                "group relative overflow-hidden rounded-xl border border-border p-5 flex flex-col justify-between transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-md min-h-[140px]",
                                                "bg-card"
                                            )}
                                        >
                                            {/* Encabezado de Tarjeta: Ícono y Número */}
                                            <div className="flex items-start justify-between w-full">
                                                <div className={cn(
                                                    "p-1.5 rounded flex items-center justify-center shadow-sm",
                                                    stateIconWrapperColors[h.estado] || stateIconWrapperColors.disponible
                                                )}>
                                                    <StateIcon className="w-3.5 h-3.5" />
                                                </div>
                                                <p className={cn(
                                                    "text-xl font-bold tracking-tight tabular-nums",
                                                    stateNumberColors[h.estado] || stateNumberColors.disponible
                                                )}>
                                                    {h.numero}
                                                </p>
                                            </div>

                                            {/* Contenido Central: Tipo y Precio */}
                                            <div className="flex flex-col gap-1 mt-2.5 w-full text-left">
                                                <p className="text-[11px] text-muted-foreground capitalize font-medium">
                                                    {h.tipo}
                                                </p>
                                                <p className="text-sm font-bold text-foreground tabular-nums">
                                                    S/ {h.precio_noche ?? h.precio ?? 0} <span className="text-[10px] font-normal text-muted-foreground">/ noche</span>
                                                </p>
                                            </div>

                                            {/* Footer: Badge y Amenities */}
                                            <div className="flex items-center justify-between w-full mt-3">
                                                <StatusBadge status={h.estado} label={cfg.label} className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded" />
                                                <div className="flex gap-1 text-muted-foreground/60">
                                                    {AMENITIES_MAP.map(a => {
                                                        const Icon = a.icon;
                                                        return parseAmenities(h.descripcion)[a.id] ? (
                                                            <span key={a.id} title={a.label} className="bg-secondary/30 p-1 rounded-md">
                                                                <Icon className="w-3 h-3" />
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </div>

                                            {/* Acciones flotantes en hover */}
                                            <div className="absolute inset-x-0 bottom-0 p-1.5 z-20 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 translate-y-2 lg:translate-y-4 lg:group-hover:translate-y-0">
                                                <div className="flex gap-1.5 p-1 bg-background/95 backdrop-blur-xl border border-border/50 rounded-lg shadow-md w-full">
                                                    <button aria-label={`Editar habitación ${h.numero}`} onClick={() => openEdit(h)} className="flex-1 text-[11px] py-1.5 rounded-md bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-95">
                                                        <Pencil className="w-3 h-3 text-primary" /> <span>Editar</span>
                                                    </button>
                                                    <button 
                                                        aria-label={`Eliminar habitación ${h.numero}`}
                                                        onClick={() => {
                                                            const reservasHab = reservasActivas.filter(
                                                                r => r.habitacion_id === h.id && ['activa', 'pendiente'].includes(r.estado)
                                                            );
                                                            const { permite, error } = puedeEliminarHabitacion(reservasHab.length);
                                                            
                                                            if (!permite) {
                                                                toast.error(error);
                                                                return;
                                                            }

                                                            setDeleteTarget(h);
                                                        }} 
                                                        className="w-8 h-8 shrink-0 rounded-md bg-background/90 hover:bg-red-500/10 backdrop-blur-sm transition-all text-muted-foreground hover:text-red-500 border border-border/60 shadow-sm flex items-center justify-center active:scale-95"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de confirmación para eliminar habitación (Tarea 3.2) */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
                <AlertDialogContent className="rounded-2xl border-red-500/20 max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-foreground">¿Eliminar habitación #{deleteTarget?.numero}?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground text-sm">
                            Esta acción eliminará permanentemente la habitación del sistema. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 mt-4">
                        <AlertDialogCancel className="rounded-xl font-semibold">Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={() => deleteTarget && del.mutate(deleteTarget.id)}
                            className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold gap-2 shadow-lg shadow-red-600/20"
                        >
                            <Trash2 className="w-4 h-4" /> Eliminar Habitación
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Slide-over (Sheet) para Editar/Crear */}
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="sm:max-w-md bg-card border-l border-border shadow-xl overflow-y-auto">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-xl font-bold">{editId ? 'Editar Habitación' : 'Nueva Habitación'}</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Número / Nombre</Label>
                                <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="101" className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                            </div>
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Piso</Label>
                                <Input value={form.piso} onChange={e => setForm({ ...form, piso: e.target.value })} placeholder="1" className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-md">
                                        {tiposHab.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capacidad (pers.)</Label>
                                <Input type="number" min={1} value={String(form.capacidad)} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Precio por noche (S/)</Label>
                            <Input type="number" min={0} value={String(form.precio_noche ?? form.precio ?? 0)} onChange={e => setForm({ ...form, precio_noche: Number(e.target.value), precio: Number(e.target.value) })} placeholder="80" className="mt-1 h-9 bg-background text-sm font-semibold rounded-md border border-input focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</Label>
                            <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                <SelectTrigger className="mt-1 h-9 bg-background text-sm font-medium rounded-md border border-input focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-md">
                                    {Object.entries(estadoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Comodidades (Amenities)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {AMENITIES_MAP.map(a => {
                                    const Icon = a.icon;
                                    return (
                                        <div key={a.id} className="flex items-center justify-between bg-muted/20 border border-border rounded-lg p-2 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-1.5">
                                                <Icon className="w-3.5 h-3.5 text-primary" />
                                                <span className="text-xs font-medium">{a.label}</span>
                                            </div>
                                            <Switch 
                                                checked={!!amenities[a.id]} 
                                                onCheckedChange={c => setAmenities({ ...amenities, [a.id]: c })} 
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 mt-4 border-t border-border/40">
                            <Button variant="outline" className="flex-1 h-9 rounded-md bg-transparent border-border hover:bg-secondary/10 hover:text-foreground font-semibold text-sm" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 h-9 rounded-md font-semibold text-sm shadow-sm" onClick={handleSave} disabled={save.isPending || !form.numero}>
                                {save.isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
});
Habitaciones.displayName = 'Habitaciones';
export default Habitaciones;