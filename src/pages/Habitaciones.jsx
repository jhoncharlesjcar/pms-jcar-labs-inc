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
        <div className="page-shell">

            <div className="page-header sm:items-center">
                <div className="flex items-center gap-3.5">
                    <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/[0.07] text-primary shadow-sm sm:flex">
                        <BedDouble className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-primary/75">Inventario operativo</p>
                        <h1 className="text-3xl font-extrabold tracking-[-0.045em] text-foreground sm:text-[2.15rem]">Habitaciones</h1>
                        <p className="mt-1 text-sm font-medium text-muted-foreground">{habitaciones.length} unidades registradas · disponibilidad en tiempo real</p>
                    </div>
                </div>
                <div className="w-full sm:w-auto">
                    <Button onClick={openNew} className="w-full gap-2 px-5 sm:w-auto">
                        <Plus className="w-4 h-4" /> Nueva Habitación
                    </Button>
                </div>
            </div>
            <div>
                <div className="room-filter-bar no-scrollbar sticky top-0 z-10 w-full max-w-full lg:relative">
                    <div className="no-scrollbar flex w-full gap-1 overflow-x-auto">
                        <button
                            onClick={() => setFiltroEstado('todos')}
                            className={cn(
                                "flex min-h-11 min-w-[128px] flex-none items-center justify-center gap-2 rounded-xl px-3.5 text-[11px] font-bold transition-all duration-200 active:scale-95 whitespace-nowrap lg:flex-1",
                                filtroEstado === 'todos' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/75 hover:text-foreground"
                            )}
                        >
                            <BedDouble className="h-4 w-4 opacity-80" />
                            <span>Todas</span>
                            <span className={cn("rounded-full px-2 py-0.5 text-[9px] tabular-nums", filtroEstado === 'todos' ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{habitaciones.length}</span>
                        </button>
                        {Object.entries(estadoConfig).map(([key, cfg]) => {
                            const count = habitaciones.filter(h => h.estado === key).length;
                            return (
                                <button
                                    key={key}
                                    onClick={() => setFiltroEstado(key)}
                                    className={cn(
                                        "flex min-h-11 min-w-[128px] flex-none items-center justify-center gap-2 rounded-xl px-3.5 text-[11px] font-bold transition-all duration-200 active:scale-95 whitespace-nowrap lg:flex-1",
                                        filtroEstado === key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/75 hover:text-foreground"
                                    )}
                                >
                                    <cfg.icon className={cn("h-4 w-4", filtroEstado === key ? "opacity-80" : cfg.color)} />
                                    <span>{cfg.label}</span>
                                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] tabular-nums", filtroEstado === key ? "bg-white/15 text-white" : "bg-muted text-muted-foreground")}>{count}</span>
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
                <div ref={gridRef} className="space-y-8">
                    {pisosOrdenados.map((piso) => (
                        <section key={piso} className="space-y-3.5">
                            {/* Floor Header */}
                            <div className="flex items-center gap-3">
                                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-secondary/25 bg-secondary/10 px-2 text-[11px] font-extrabold text-foreground tabular-nums">
                                    {piso === 'Sin Piso' ? '—' : String(piso).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                    <h2 className="whitespace-nowrap text-sm font-extrabold tracking-tight text-foreground">
                                        {piso === 'Sin Piso' ? 'Sin asignar' : `Piso ${piso}`}
                                    </h2>
                                    <p className="text-[10px] font-semibold text-muted-foreground">{agrupadasPorPiso[piso].length} habitaciones</p>
                                </div>
                                <div className="h-px flex-1 bg-border/70" />
                            </div>

                            {/* Floor Grid */}
                            <div className="room-card-grid">
                                {agrupadasPorPiso[piso].map(h => {
                                    const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
                                    const stateIconWrapperColors = {
                                        disponible: 'bg-green-500/10 text-green-600 dark:text-green-400',
                                        ocupada: 'bg-red-500/10 text-red-600 dark:text-red-400',
                                        reservada: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                                        mantenimiento: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                        limpieza: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                                    };
                                    const StateIcon = cfg.icon;
                                    const roomAmenities = AMENITIES_MAP.filter(a => parseAmenities(h.descripcion)[a.id]);

                                    return (
                                        <article
                                            key={h.id}
                                            data-state={h.estado}
                                            className="room-card group flex flex-col justify-between"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <div className={cn(
                                                        "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-current/10",
                                                        stateIconWrapperColors[h.estado] || stateIconWrapperColors.disponible
                                                    )}>
                                                        <StateIcon className="h-4 w-4" />
                                                    </div>
                                                    <StatusBadge status={h.estado} label={cfg.label} showIcon={false} className="rounded-full px-2 py-1 text-[9px] font-extrabold tracking-[0.08em]" />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button aria-label={`Editar habitación ${h.numero}`} title="Editar habitación" onClick={() => openEdit(h)} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        aria-label={`Eliminar habitación ${h.numero}`}
                                                        title="Eliminar habitación"
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
                                                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="my-4 flex items-end justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground">Habitación</p>
                                                    <p className="room-card-number font-extrabold text-foreground">{h.numero}</p>
                                                    <p className="mt-1.5 truncate text-[11px] font-semibold capitalize text-muted-foreground">{h.tipo}{h.piso ? ` · Piso ${h.piso}` : ''}</p>
                                                </div>
                                                <div className="flex-shrink-0 text-right">
                                                    <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Tarifa noche</p>
                                                    <p className="mt-1 text-lg font-extrabold tracking-[-0.04em] text-foreground tabular-nums"><span className="mr-1 text-[11px] font-bold text-muted-foreground">S/</span>{h.precio_noche ?? h.precio ?? 0}</p>
                                                </div>
                                            </div>

                                            <div className="flex min-h-8 items-center justify-between gap-3 border-t border-border/60 pt-3">
                                                <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                                                    {roomAmenities.length > 0 ? roomAmenities.map(a => {
                                                        const Icon = a.icon;
                                                        return (
                                                            <span key={a.id} title={a.label} className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground">
                                                                <Icon className="h-3.5 w-3.5" />
                                                            </span>
                                                        );
                                                    }) : <span className="truncate text-[10px] font-semibold">Equipamiento estándar</span>}
                                                </div>
                                                <span className="flex-shrink-0 rounded-lg bg-muted/65 px-2 py-1 text-[9px] font-extrabold text-muted-foreground">{h.capacidad || 1} huésped{Number(h.capacidad || 1) === 1 ? '' : 'es'}</span>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
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
                            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={handleSave} disabled={save.isPending || !form.numero}>
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
