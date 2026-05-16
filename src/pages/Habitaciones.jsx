import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BedDouble, Wrench, CheckCircle2, CalendarDays, User, Sparkles, Pencil, Trash2, Wifi, Tv, Droplets, Bath } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/use-hotel-data';
import { motion, AnimatePresence } from 'framer-motion';

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

const tiposHab = ['simple', 'doble simple', 'matrimonial', 'doble matrimonial', 'mixta', 'queen'];

const empty = { numero: '', tipo: 'simple', precio_noche: 0, capacidad: 1, piso: '', descripcion: '', estado: 'disponible' };

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

export default function Habitaciones() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(empty);
    const [amenities, setAmenities] = useState({ wifi: false, tv: false, agua: false, bano: false });
    const [editId, setEditId] = useState(null);
    const [filtroEstado, setFiltroEstado] = useState('todos');

    const { data: habitaciones = [], isLoading } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const save = useMutation({
        /** @param {any} data */
        mutationFn: (data) => editId ? hotelDb.Habitacion.update(editId, data) : hotelDb.Habitacion.create(data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['habitaciones'] }); setOpen(false); setForm(empty); setEditId(null); },
    });

    const del = useMutation({
        /** @param {any} id */
        mutationFn: (id) => hotelDb.Habitacion.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['habitaciones'] }),
    });

    const openEdit = (h) => { setForm({ ...h }); setEditId(h.id); setAmenities(parseAmenities(h.descripcion)); setOpen(true); };
    const openNew = () => { setForm(empty); setEditId(null); setAmenities({ wifi: false, tv: false, agua: false, bano: false }); setOpen(true); };

    const handleSave = () => {
        const isDuplicate = habitaciones.some(
            h => String(h.numero).toLowerCase() === String(form.numero).toLowerCase() && h.id !== editId
        );

        if (isDuplicate) {
            alert(`La habitación #${form.numero} ya existe. Por favor, usa un número diferente.`);
            return;
        }

        const dataToSave = { ...form, descripcion: JSON.stringify(amenities) };
        save.mutate(dataToSave);
    };

    const filtradas = (filtroEstado === 'todos' ? habitaciones : habitaciones.filter(h => h.estado === filtroEstado))
        .sort((a, b) => {
            const numA = parseInt(a.numero, 10);
            const numB = parseInt(b.numero, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a.numero).localeCompare(String(b.numero));
        });

    return (
        <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="space-y-6"
        >
            <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
                <div>
                    <h1 className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">Habitaciones</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{habitaciones.length} habitaciones registradas</p>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
                    <Button onClick={openNew} className="w-full sm:w-auto gap-2 shadow-lg shadow-primary/20 h-11 sm:h-10 rounded-xl font-black uppercase text-[10px]">
                        <Plus className="w-4 h-4" /> Nueva Habitación
                    </Button>
                </motion.div>
            </motion.div>
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-3"
            >
                <div className="bg-card/50 backdrop-blur-md p-1.5 rounded-[1.25rem] border border-border/40 shadow-sm mb-6 sticky top-0 z-10 lg:relative">
                    <div className="flex gap-1 overflow-x-auto scrollbar-hide no-scrollbar">
                        <button
                            onClick={() => setFiltroEstado('todos')}
                            className={cn(
                                "flex-1 min-w-[80px] py-2 px-3 rounded-[1rem] text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex flex-col items-center gap-0.5",
                                filtroEstado === 'todos' ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" : "text-muted-foreground hover:bg-secondary/50"
                            )}
                        >
                            <span className="opacity-60"><BedDouble className="w-3.5 h-3.5" /></span>
                            <span>Todas ({habitaciones.length})</span>
                        </button>
                        {Object.entries(estadoConfig).map(([key, cfg]) => {
                            const count = habitaciones.filter(h => h.estado === key).length;
                            const activeColors = {
                                disponible: "bg-green-500 text-white shadow-green-500/20",
                                ocupada: "bg-red-500 text-white shadow-red-500/20",
                                reservada: "bg-blue-500 text-white shadow-blue-500/20",
                                mantenimiento: "bg-amber-500 text-white shadow-amber-500/20",
                                limpieza: "bg-purple-500 text-white shadow-purple-500/20"
                            };
                            return (
                                <button
                                    key={key}
                                    onClick={() => setFiltroEstado(key)}
                                    className={cn(
                                        "flex-1 min-w-[80px] py-2 px-3 rounded-[1rem] text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex flex-col items-center gap-0.5",
                                        filtroEstado === key ? activeColors[key] + " shadow-lg scale-[1.02]" : "text-muted-foreground hover:bg-secondary/50"
                                    )}
                                >
                                    <span className="opacity-60"><cfg.icon className="w-3.5 h-3.5" /></span>
                                    <span>{cfg.label} ({count})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </motion.div>


            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-5 animate-pulse h-40 shadow-sm" />
                    ))}
                </div>
            ) : (
                <motion.div 
                    layout
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
                    }}
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                >
                    <AnimatePresence>
                        {filtradas.map(h => {
                            const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
                            const StateIcon = cfg.icon;
                            const stateCardColors = {
                                disponible: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800/50',
                                ocupada: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800/50',
                                reservada: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800/50',
                                mantenimiento: 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800/50',
                                limpieza: 'bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800/50',
                            };
                            const stateBadgeColors = {
                                disponible: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700/50',
                                ocupada: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700/50',
                                reservada: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/50 dark:text-blue-400 dark:border-blue-700/50',
                                mantenimiento: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-400 dark:border-amber-700/50',
                                limpieza: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/50 dark:text-purple-400 dark:border-purple-700/50',
                            };
                            const stateNumberColors = {
                                disponible: 'text-green-700 dark:text-green-400',
                                ocupada: 'text-red-700 dark:text-red-400',
                                reservada: 'text-blue-700 dark:text-blue-400',
                                mantenimiento: 'text-amber-700 dark:text-amber-400',
                                limpieza: 'text-purple-700 dark:text-purple-400',
                            };
                            return (
                                <motion.div 
                                    layout
                                    variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    whileHover={{ y: -4 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    key={h.id} 
                                    className={cn(
                                        "group relative overflow-hidden rounded-2xl border-2 p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-1 transition-all duration-300 hover:shadow-xl min-h-[160px] sm:min-h-[140px]",
                                        stateCardColors[h.estado] || stateCardColors.disponible
                                    )}
                                >
                                    {/* Número de habitación */}
                                    <p className={cn("text-2xl sm:text-3xl font-black tracking-tight", stateNumberColors[h.estado] || stateNumberColors.disponible)}>
                                        {h.numero}
                                    </p>

                                    {/* Tipo de habitación */}
                                    <p className="text-xs text-muted-foreground capitalize font-medium">
                                        {h.tipo}{h.piso ? ` · Piso ${h.piso}` : ''}
                                    </p>

                                    {/* Precio */}
                                    <p className="text-sm font-bold text-foreground mt-1">
                                        S/ {h.precio_noche}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">por noche · {h.capacidad} persona(s)</p>

                                    {/* Badge de estado */}
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border mt-2",
                                        stateBadgeColors[h.estado] || stateBadgeColors.disponible
                                    )}>
                                        {cfg.label}
                                    </span>

                                    {/* Amenities row */}
                                    <div className="flex gap-1.5 text-muted-foreground/60 mt-1.5">
                                        {AMENITIES_MAP.map(a => {
                                            const Icon = a.icon;
                                            return parseAmenities(h.descripcion)[a.id] ? (
                                                <span key={a.id} title={a.label}>
                                                    <Icon className="w-3.5 h-3.5" />
                                                </span>
                                            ) : null;
                                        })}
                                    </div>

                                    {/* Acciones (aparecen al hover o visibles en móvil) */}
                                    <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-1.5 sm:p-2 bg-gradient-to-t from-background via-background/80 to-transparent opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-0 sm:translate-y-1 sm:group-hover:translate-y-0">
                                        <button onClick={() => openEdit(h)} className="flex-1 text-[10px] sm:text-xs py-1.5 sm:py-2 rounded-lg bg-background/90 hover:bg-background backdrop-blur-sm transition-all text-foreground font-black uppercase flex items-center justify-center gap-1 border border-border/50 shadow-sm">
                                            <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> <span className="hidden sm:inline">Editar</span>
                                        </button>
                                        <button onClick={() => { if (confirm('¿Eliminar habitación?')) del.mutate(h.id); }} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-lg bg-background/90 hover:bg-red-500/10 backdrop-blur-sm transition-all text-muted-foreground hover:text-red-500 border border-border/50 shadow-sm flex items-center justify-center">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                    {filtradas.length === 0 && (
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            className="col-span-full text-center py-16 text-muted-foreground"
                        >
                            <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No hay habitaciones {filtroEstado !== 'todos' ? `en estado "${estadoConfig[filtroEstado]?.label}"` : ''}</p>
                        </motion.div>
                    )}
                </motion.div>
            )}

            {/* Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="font-display text-2xl">{editId ? 'Editar Habitación' : 'Nueva Habitación'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Número / Nombre</Label>
                                <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="101" className="mt-1 bg-background/50" />
                            </div>
                            <div>
                                <Label>Piso</Label>
                                <Input value={form.piso} onChange={e => setForm({ ...form, piso: e.target.value })} placeholder="1" className="mt-1 bg-background/50" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Tipo</Label>
                                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger className="mt-1 bg-background/50"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {tiposHab.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Capacidad (personas)</Label>
                                <Input type="number" min={1} value={String(form.capacidad)} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1 bg-background/50" />
                            </div>
                        </div>
                        <div>
                            <Label>Precio por noche (S/)</Label>
                            <Input type="number" min={0} value={String(form.precio_noche)} onChange={e => setForm({ ...form, precio_noche: Number(e.target.value) })} placeholder="80" className="mt-1 bg-background/50" />
                        </div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                <SelectTrigger className="mt-1 bg-background/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(estadoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="mb-2 block">Comodidades (Amenities)</Label>
                            <div className="grid grid-cols-2 gap-3">
                                {AMENITIES_MAP.map(a => {
                                    const Icon = a.icon;
                                    return (
                                        <div key={a.id} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-xl p-2.5 hover:bg-background/80 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <Icon className="w-4 h-4 text-muted-foreground" />
                                                <span className="text-sm font-medium">{a.label}</span>
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
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 bg-transparent border-border hover:bg-secondary/10 hover:text-foreground" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={handleSave} disabled={save.isPending || !form.numero || !form.precio_noche}>
                                {save.isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}