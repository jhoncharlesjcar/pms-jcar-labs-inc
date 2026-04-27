import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/use-hotel-data';

const EMOJI_DEFAULT = {
    bebidas: '🥤', snacks: '🍿', aseo: '🧴',
    licores: '🍺', cigarros: '🚬', otros: '📦',
};

const emptyProd = { nombre: '', categoria_id: '', precio: '', emoji: '', activo: true, stock: 99 };

export default function CatalogoMinimarket({ onAgregar, itemsEnCarrito = [] }) {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [catActiva, setCatActiva] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(emptyProd);
    const [gestionando, setGestionando] = useState(false);

    // 1. Cargar Categorías de la DB
    const { data: categoriasDb = [] } = useQuery({
        queryKey: ['categorias-minimarket', hotelId],
        queryFn: () => hotelDb.CategoriaProducto.list(),
        enabled: !!hotelId,
    });

    // 2. Cargar Productos de la DB
    const { data: productos = [] } = useQuery({
        queryKey: ['productos-minimarket', hotelId],
        queryFn: () => hotelDb.Producto.list(),
        enabled: !!hotelId,
    });

    const CATEGORIAS_LISTA = [
        { id: 'todos', label: 'Todos', emoji: '🛒' },
        ...categoriasDb.map(c => ({
            id: c.id,
            label: c.nombre,
            emoji: EMOJI_DEFAULT[c.nombre.toLowerCase()] || '📦'
        }))
    ];

    const saveProd = useMutation({
        mutationFn: (data) => editando
            ? hotelDb.Producto.update(editando.id, data)
            : hotelDb.Producto.create(data),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['productos-minimarket'] }); 
            setModalOpen(false); 
            setEditando(null); 
            setForm(emptyProd); 
        },
    });

    const deleteProd = useMutation({
        mutationFn: (id) => hotelDb.Producto.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['productos-minimarket'] }),
    });

    const filtrados = catActiva === 'todos'
        ? productos.filter(p => p.activo !== false)
        : productos.filter(p => p.categoria_id === catActiva && p.activo !== false);

    const cantidadEnCarrito = (prodId) => {
        const item = itemsEnCarrito.find(i => i.id === prodId);
        return item ? item.cantidad : 0;
    };

    const abrirNuevo = () => { setEditando(null); setForm(emptyProd); setModalOpen(true); };
    const abrirEditar = (p) => { 
        setEditando(p); 
        setForm({ ...p, precio: String(p.precio_venta || 0) }); 
        setModalOpen(true); 
    };

    return (
        <div className="space-y-3">
            {/* Filtros de categoría */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
                {CATEGORIAS_LISTA.map(cat => (
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

            {/* Grid de productos */}
            {filtrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p className="text-3xl mb-2">🛒</p>
                    <p className="text-sm">Sin productos en esta categoría</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-2.5 pb-20 lg:pb-4">
                    {filtrados.map(prod => {
                        const qty = cantidadEnCarrito(prod.id);
                        return (
                            <div
                                key={prod.id}
                                onClick={() => !gestionando && onAgregar({ ...prod, precio: prod.precio_venta })}
                                className={cn(
                                    "relative bg-card border rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all select-none",
                                    !gestionando && "active:scale-95 hover:border-primary hover:shadow-md cursor-pointer",
                                    qty > 0 && "border-primary bg-primary/5",
                                    gestionando && "cursor-default"
                                )}
                            >
                                {qty > 0 && !gestionando && (
                                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                        {qty}
                                    </span>
                                )}

                                <p className="text-xs font-semibold text-foreground text-center leading-tight line-clamp-2 mt-2">{prod.nombre}</p>
                                <p className="text-sm font-bold text-primary">S/ {Number(prod.precio_venta || 0).toFixed(2)}</p>
                                
                                {/* Indicador de Stock */}
                                <div className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-medium mt-1",
                                    prod.stock <= 5 ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground"
                                )}>
                                    Stock: {prod.stock || 0}
                                </div>

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
                            <Input className="mt-1" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Red Bull" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Precio S/ *</Label>
                                <Input className="mt-1" type="number" min="0" step="0.10" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="12.00" />
                            </div>
                            <div>
                                <Label>Stock Inicial *</Label>
                                <Input className="mt-1" type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} placeholder="50" />
                            </div>
                        </div>
                        <div>
                            <Label>Categoría</Label>
                            <Select value={form.categoria_id} onValueChange={v => setForm({ ...form, categoria_id: v })}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {categoriasDb.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" disabled={saveProd.isPending || !form.nombre || !form.precio}
                                onClick={() => {
                                    const dataToSave = {
                                        nombre: form.nombre,
                                        categoria_id: form.categoria_id,
                                        precio_venta: Number(form.precio),
                                        stock: Number(form.stock),
                                        activo: form.activo ?? true
                                    };
                                    saveProd.mutate(dataToSave);
                                }}>
                                {saveProd.isPending ? 'Guardando...' : editando ? 'Actualizar' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}