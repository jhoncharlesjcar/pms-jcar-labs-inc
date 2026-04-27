import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Plus, Pencil, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useHotel } from '@/lib/HotelContext';

const CATEGORIAS = [
    { value: 'restaurante', label: 'Restaurante', emoji: '🍽️' },
    { value: 'bar', label: 'Bar', emoji: '🍺' },
    { value: 'lavanderia', label: 'Lavandería', emoji: '👕' },
    { value: 'room_service', label: 'Room Service', emoji: '🛎️' },
    { value: 'minibar', label: 'Minibar', emoji: '🧃' },
    { value: 'otros', label: 'Otros', emoji: '📦' },
];

const emptyForm = { nombre: '', categoria: 'restaurante', precio: '', descripcion: '', emoji: '', disponible: true };

export default function CatalogoServicios({ onAgregar }) {
    const qc = useQueryClient();
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;
    const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const { data: servicios = [] } = useQuery({
        queryKey: ['servicios', hotelId],
        queryFn: () => db.entities.ServicioExtra.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });

    const guardar = useMutation({
        mutationFn: (data) => editando
            ? db.entities.ServicioExtra.update(editando.id, data)
            : db.entities.ServicioExtra.create({ ...data, hotel_id: hotelId }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['servicios'] }); setModalOpen(false); setEditando(null); setForm(emptyForm); },
    });

    const eliminar = useMutation({
        mutationFn: (id) => db.entities.ServicioExtra.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['servicios'] }),
    });

    const abrirEditar = (s) => { setEditando(s); setForm({ nombre: s.nombre, categoria: s.categoria, precio: s.precio, descripcion: s.descripcion || '', emoji: s.emoji || '', disponible: s.disponible ?? true }); setModalOpen(true); };
    const abrirNuevo = () => { setEditando(null); setForm(emptyForm); setModalOpen(true); };

    const filtrados = categoriaFiltro === 'todos' ? servicios : servicios.filter(s => s.categoria === categoriaFiltro);
    const disponibles = filtrados.filter(s => s.disponible !== false);

    return (
        <div className="space-y-4">
            {/* Filtros de categoría */}
            <div className="flex gap-2 flex-wrap">
                <button onClick={() => setCategoriaFiltro('todos')}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                        categoriaFiltro === 'todos' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-secondary")}>
                    Todos
                </button>
                {CATEGORIAS.map(c => (
                    <button key={c.value} onClick={() => setCategoriaFiltro(c.value)}
                        className={cn("px-3 py-1.5 rounded-xl text-xs font-medium border transition-all",
                            categoriaFiltro === c.value ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-secondary")}>
                        {c.emoji} {c.label}
                    </button>
                ))}
            </div>

            {/* Grid de productos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {disponibles.map(s => {
                    const cat = CATEGORIAS.find(c => c.value === s.categoria);
                    return (
                        <div key={s.id} className="bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-all group relative">
                            {/* Botones editar/eliminar */}
                            <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                                <button onClick={() => abrirEditar(s)} className="w-6 h-6 bg-secondary rounded-lg flex items-center justify-center hover:bg-primary/10">
                                    <Pencil className="w-3 h-3 text-muted-foreground" />
                                </button>
                                <button onClick={() => eliminar.mutate(s.id)} className="w-6 h-6 bg-secondary rounded-lg flex items-center justify-center hover:bg-red-100">
                                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </button>
                            </div>
                            <button className="w-full text-left" onClick={() => onAgregar(s)}>
                                <div className="text-2xl mb-1">{s.emoji || cat?.emoji || '📦'}</div>
                                <p className="font-medium text-sm text-foreground leading-tight">{s.nombre}</p>
                                <p className="text-xs text-muted-foreground capitalize">{cat?.label}</p>
                                <p className="font-bold text-primary mt-1 text-sm">S/ {Number(s.precio).toFixed(2)}</p>
                            </button>
                        </div>
                    );
                })}

                {/* Botón agregar nuevo */}
                <button onClick={abrirNuevo}
                    className="border-2 border-dashed border-border rounded-xl p-3 flex flex-col items-center justify-center gap-1 hover:border-primary/50 hover:bg-primary/5 transition-all min-h-[100px]">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Agregar</span>
                </button>
            </div>

            {disponibles.length === 0 && categoriaFiltro !== 'todos' && (
                <p className="text-center text-sm text-muted-foreground py-4">Sin productos en esta categoría</p>
            )}

            {/* Modal crear/editar */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Nombre *</Label>
                            <Input className="mt-1" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Desayuno buffet" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Categoría</Label>
                                <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Emoji</Label>
                                <Input className="mt-1" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} placeholder="🍳" />
                            </div>
                        </div>
                        <div>
                            <Label>Precio (S/) *</Label>
                            <Input className="mt-1" type="number" min="0" step="0.50" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0.00" />
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Input className="mt-1" value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional..." />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" disabled={guardar.isPending || !form.nombre || !form.precio}
                                onClick={() => guardar.mutate({ ...form, precio: Number(form.precio) })}>
                                {guardar.isPending ? 'Guardando...' : <><Check className="w-4 h-4 mr-1" /> Guardar</>}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}