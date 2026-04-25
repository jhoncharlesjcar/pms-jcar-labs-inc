import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Plus, Minus, Settings2, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useHotel } from '@/lib/HotelContext';

const CATEGORIAS = [
    { id: 'todos', label: 'Todos', emoji: '🛒' },
    { id: 'bebidas', label: 'Bebidas', emoji: '🥤' },
    { id: 'snacks', label: 'Snacks', emoji: '🍿' },
    { id: 'lacteos', label: 'Lácteos', emoji: '🥛' },
    { id: 'higiene', label: 'Higiene', emoji: '🧴' },
    { id: 'licores', label: 'Licores', emoji: '🍺' },
    { id: 'cigarros', label: 'Cigarros', emoji: '🚬' },
    { id: 'otros', label: 'Otros', emoji: '📦' },
];

const EMOJI_DEFAULT = {
    bebidas: '🥤', snacks: '🍿', lacteos: '🥛', higiene: '🧴',
    licores: '🍺', cigarros: '🚬', otros: '📦',
};

const emptyProd = { nombre: '', categoria: 'bebidas', precio: '', emoji: '', disponible: true, stock: 99 };

export default function CatalogoMinimarket({ onAgregar, itemsEnCarrito = [] }) {
    const qc = useQueryClient();
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;
    const [catActiva, setCatActiva] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(emptyProd);
    const [gestionando, setGestionando] = useState(false);

    const { data: productos = [] } = useQuery({
        queryKey: ['productos-minimarket', hotelId],
        queryFn: () => db.entities.ServicioExtra.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });

    const saveProd = useMutation({
        mutationFn: (data) => editando
            ? db.entities.ServicioExtra.update(editando.id, data)
            : db.entities.ServicioExtra.create({ ...data, hotel_id: hotelId }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['productos-minimarket'] }); setModalOpen(false); setEditando(null); setForm(emptyProd); },
    });

    const deleteProd = useMutation({
        mutationFn: (id) => db.entities.ServicioExtra.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['productos-minimarket'] }),
    });

    const filtrados = catActiva === 'todos'
        ? productos.filter(p => p.disponible !== false)
        : productos.filter(p => p.categoria === catActiva && p.disponible !== false);

    const cantidadEnCarrito = (prodId) => {
        const item = itemsEnCarrito.find(i => i.id === prodId);
        return item ? item.cantidad : 0;
    };

    const abrirNuevo = () => { setEditando(null); setForm(emptyProd); setModalOpen(true); };
    const abrirEditar = (p) => { setEditando(p); setForm({ ...p, precio: String(p.precio) }); setModalOpen(true); };

    return (
        <div className="space-y-3">
            {/* Filtros de categoría — scroll horizontal táctil */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {CATEGORIAS.map(cat => (
                    <button
                        key={cat.id}
                        onClick={() => setCatActiva(cat.id)}
                        className={cn(
                            "flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border",
                            catActiva === cat.id
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card text-muted-foreground border-border hover:bg-secondary"
                        )}
                    >
                        <span className="text-lg leading-none">{cat.emoji}</span>
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* Barra gestión */}
            <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{filtrados.length} producto(s)</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGestionando(!gestionando)} className="gap-1 text-xs h-7">
                        <Settings2 className="w-3 h-3" /> {gestionando ? 'Listo' : 'Gestionar'}
                    </Button>
                    {gestionando && (
                        <Button size="sm" onClick={abrirNuevo} className="gap-1 text-xs h-7">
                            <Plus className="w-3 h-3" /> Nuevo
                        </Button>
                    )}
                </div>
            </div>

            {/* Grid de productos — táctil amigable */}
            {filtrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p className="text-3xl mb-2">🛒</p>
                    <p className="text-sm">Sin productos en esta categoría</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={abrirNuevo}>+ Agregar producto</Button>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 pb-20 lg:pb-4">
                    {filtrados.map(prod => {
                        const qty = cantidadEnCarrito(prod.id);
                        return (
                            <div
                                key={prod.id}
                                onClick={() => !gestionando && onAgregar(prod)}
                                className={cn(
                                    "relative bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all select-none",
                                    !gestionando && "active:scale-95 hover:border-primary hover:shadow-md cursor-pointer",
                                    qty > 0 && "border-primary bg-primary/5",
                                    gestionando && "cursor-default"
                                )}
                            >
                                {/* Badge cantidad */}
                                {qty > 0 && !gestionando && (
                                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                        {qty}
                                    </span>
                                )}

                                {/* Emoji */}
                                <span className="text-3xl leading-none">
                                    {prod.emoji || EMOJI_DEFAULT[prod.categoria] || '📦'}
                                </span>

                                {/* Nombre */}
                                <p className="text-xs font-semibold text-foreground text-center leading-tight line-clamp-2">{prod.nombre}</p>

                                {/* Precio */}
                                <p className="text-sm font-bold text-primary">S/ {Number(prod.precio).toFixed(2)}</p>

                                {/* Acciones gestión */}
                                {gestionando && (
                                    <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => abrirEditar(prod)} className="p-1.5 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground transition-all">
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => { if (confirm(`¿Eliminar "${prod.nombre}"?`)) deleteProd.mutate(prod.id); }}
                                            className="p-1.5 rounded-lg bg-secondary hover:bg-destructive hover:text-destructive-foreground transition-all">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}

                                {/* Indicador de toque si no gestiona */}
                                {!gestionando && (
                                    <div className="w-full bg-secondary rounded-full h-0.5 mt-0.5">
                                        <div className="bg-primary h-0.5 rounded-full transition-all" style={{ width: qty > 0 ? '100%' : '0%' }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal crear/editar */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>{editando ? 'Editar Producto' : 'Nuevo Producto'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <Label>Nombre *</Label>
                            <Input className="mt-1" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Inca Kola 500ml" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Precio S/ *</Label>
                                <Input className="mt-1" type="number" min="0" step="0.10" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="2.50" />
                            </div>
                            <div>
                                <Label>Emoji</Label>
                                <Input className="mt-1" value={form.emoji} onChange={e => setForm({ ...form, emoji: e.target.value })} placeholder="🥤" />
                            </div>
                        </div>
                        <div>
                            <Label>Categoría</Label>
                            <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.filter(c => c.id !== 'todos').map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" disabled={saveProd.isPending || !form.nombre || !form.precio}
                                onClick={() => saveProd.mutate({ ...form, precio: Number(form.precio) })}>
                                {saveProd.isPending ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}