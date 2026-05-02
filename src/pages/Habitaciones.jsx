import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, BedDouble, Wrench, CheckCircle, Clock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/use-hotel-data';

const estadoConfig = {
    disponible: { label: 'Disponible', icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    ocupada: { label: 'Ocupada', icon: BedDouble, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
    reservada: { label: 'Reservada', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
    mantenimiento: { label: 'Mantenimiento', icon: Wrench, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

const tiposHab = ['simple', 'doble simple', 'matrimonial', 'doble matrimonial', 'mixta', 'queen'];

const empty = { numero: '', tipo: 'simple', precio_noche: 0, capacidad: 1, piso: '', descripcion: '', estado: 'disponible' };

export default function Habitaciones() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(empty);
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

    const openEdit = (h) => { setForm({ ...h }); setEditId(h.id); setOpen(true); };
    const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };

    const filtradas = filtroEstado === 'todos' ? habitaciones : habitaciones.filter(h => h.estado === filtroEstado);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground">Habitaciones</h1>
                    <p className="text-muted-foreground mt-1">{habitaciones.length} habitaciones registradas</p>
                </div>
                <Button onClick={openNew} className="gap-2">
                    <Plus className="w-4 h-4" /> Nueva Habitación
                </Button>
            </div>

            {/* Filtros */}
            <div className="flex gap-2 flex-wrap">
                {['todos', 'disponible', 'ocupada', 'reservada', 'mantenimiento'].map(e => (
                    <button
                        key={e}
                        onClick={() => setFiltroEstado(e)}
                        className={cn(
                            "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                            filtroEstado === e ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary"
                        )}
                    >
                        {e === 'todos' ? 'Todas' : estadoConfig[e]?.label}
                        <span className="ml-2 text-xs opacity-70">
                            {e === 'todos' ? habitaciones.length : habitaciones.filter(h => h.estado === e).length}
                        </span>
                    </button>
                ))}
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="bg-card rounded-2xl border border-border p-5 animate-pulse h-40" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filtradas.map(h => {
                        const cfg = estadoConfig[h.estado] || estadoConfig.disponible;
                        const StateIcon = cfg.icon;
                        return (
                            <div key={h.id} className={cn("rounded-2xl border-2 p-5 flex flex-col gap-3 transition-all hover:shadow-md", cfg.bg)}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-2xl font-bold text-foreground">#{h.numero}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{h.tipo}{h.piso ? ` · Piso ${h.piso}` : ''}</p>
                                    </div>
                                    <StateIcon className={cn("w-5 h-5", cfg.color)} />
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-foreground">S/ {h.precio_noche}</p>
                                    <p className="text-xs text-muted-foreground">por noche · {h.capacidad} persona(s)</p>
                                </div>
                                <span className={cn("text-xs font-medium px-2 py-1 rounded-lg w-fit", cfg.color, "bg-white/60")}>
                                    {cfg.label}
                                </span>
                                <div className="flex gap-2 mt-auto">
                                    <button onClick={() => openEdit(h)} className="flex-1 text-xs py-1.5 rounded-lg bg-white/70 hover:bg-white transition-all text-foreground font-medium flex items-center justify-center gap-1">
                                        <Pencil className="w-3 h-3" /> Editar
                                    </button>
                                    <button onClick={() => { if (confirm('¿Eliminar habitación?')) del.mutate(h.id); }} className="p-1.5 rounded-lg bg-white/70 hover:bg-red-50 hover:text-red-600 transition-all text-muted-foreground">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    {filtradas.length === 0 && (
                        <div className="col-span-full text-center py-16 text-muted-foreground">
                            <BedDouble className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No hay habitaciones {filtroEstado !== 'todos' ? `en estado "${estadoConfig[filtroEstado]?.label}"` : ''}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-display">{editId ? 'Editar Habitación' : 'Nueva Habitación'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Número / Nombre</Label>
                                <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="101" className="mt-1" />
                            </div>
                            <div>
                                <Label>Piso</Label>
                                <Input value={form.piso} onChange={e => setForm({ ...form, piso: e.target.value })} placeholder="1" className="mt-1" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Tipo</Label>
                                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {tiposHab.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Capacidad (personas)</Label>
                                <Input type="number" min={1} value={String(form.capacidad)} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1" />
                            </div>
                        </div>
                        <div>
                            <Label>Precio por noche (S/)</Label>
                            <Input type="number" min={0} value={String(form.precio_noche)} onChange={e => setForm({ ...form, precio_noche: Number(e.target.value) })} placeholder="80" className="mt-1" />
                        </div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(estadoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Descripción (opcional)</Label>
                            <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Con baño privado, WiFi..." className="mt-1" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={() => save.mutate(form)} disabled={save.isPending || !form.numero || !form.precio_noche}>
                                {save.isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}