import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings2, Pencil, Trash2, FolderPlus, Loader2, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/useHotelData';
import { toast } from 'sonner';
import EmptyState from '@/components/common/EmptyState';

const EMOJI_DEFAULT = {
    bebidas: '🥤', snacks: '🍿', aseo: '🧴',
    licores: '🍺', cigarros: '🚬', otros: '📦',
    comida: '🍔', lacteos: '🥛', limpieza: '🧹',
    'bebidas calientes': '☕', 'bebidas frias': '🥤',
    cafe: '☕', te: '🍵', postres: '🍰'
};

const emptyProd = { nombre: '', categoria_id: '', precio: '', emoji: '', activo: true, stock: 99 };

/**
 * @param {{ onAgregar?: (prod: any) => void, itemsEnCarrito?: any[] }} props
 */
const CatalogoMinimarket = memo(function CatalogoMinimarket(/** @type {any} */ { onAgregar, itemsEnCarrito = [] }) {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [catActiva, setCatActiva] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState(emptyProd);
    const [gestionando, setGestionando] = useState(false);
    const [modalCatOpen, setModalCatOpen] = useState(false);
    const [nuevaCat, setNuevaCat] = useState('');
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
        /** @param {any} data */
        mutationFn: (data) => editando
            ? hotelDb.Producto.update(editando.id, data)
            : hotelDb.Producto.create(data),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ['productos-minimarket'] }); 
            setModalOpen(false); 
            setEditando(null); 
            setForm(emptyProd); 
            toast.success(editando ? 'Producto actualizado' : 'Producto creado', { description: 'El catálogo se ha actualizado correctamente.' });
        },
        onError: () => toast.error('Error', { description: 'No se pudo guardar el producto.' })
    });

    const deleteProd = useMutation({
        mutationFn: (id) => hotelDb.Producto.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['productos-minimarket'] });
            toast.success('Producto eliminado', { description: 'El producto ha sido removido del catálogo.' });
        },
        onError: () => toast.error('Error', { description: 'No se pudo eliminar el producto.' })
    });

    const saveCat = useMutation({
        /** @param {any} data */
        mutationFn: (data) => hotelDb.CategoriaProducto.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['categorias-minimarket', hotelId] });
            setNuevaCat('');
            toast.success('Categoría creada', { description: 'Ya puedes organizar tus productos en esta categoría.' });
        },
        onError: () => toast.error('Error', { description: 'No se pudo crear la categoría.' })
    });

    const deleteCat = useMutation({
        mutationFn: (id) => hotelDb.CategoriaProducto.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['categorias-minimarket', hotelId] });
            qc.invalidateQueries({ queryKey: ['productos-minimarket', hotelId] });
            toast.success('Categoría eliminada', { description: 'La categoría ha sido eliminada correctamente.' });
        },
        onError: () => toast.error('Error', { description: 'No se pudo eliminar la categoría.' })
    });

    const gridRef = useRef(null);

    const filtrados = catActiva === 'todos'
        ? productos.filter(p => p.activo !== false)
        : productos.filter(p => p.categoria_id === catActiva && p.activo !== false);

    const cantidadEnCarrito = (prodId) => {
        const item = itemsEnCarrito.find(i => i.id === prodId);
        return item ? item.cantidad : 0;
    };

    const stockDisponible = (prod) => {
        const enCarrito = cantidadEnCarrito(prod.id);
        return (prod.stock || 0) - enCarrito;
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
            <div className="relative">
                <div className="flex gap-2 p-1 bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 overflow-x-auto scrollbar-hide no-scrollbar shadow-sm">
                    {CATEGORIAS_LISTA.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setCatActiva(cat.id)}
                            className={cn(
                                "flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 active:scale-95",
                                catActiva === cat.id
                                    ? "bg-background text-foreground shadow-sm border border-border/60 dark:border-white/10"
                                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent"
                            )}
                        >
                            <span className="text-xs leading-none drop-shadow-sm">{cat.emoji}</span>
                            <span className="uppercase tracking-widest text-[9px] sm:text-[10px]">{cat.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Barra gestión */}
            <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground font-medium">{filtrados.length} producto(s)</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setGestionando(!gestionando)} className="gap-1 text-[10px] h-7 rounded-md font-bold px-2.5">
                        <Settings2 className="w-3.5 h-3.5" /> {gestionando ? 'Listo' : 'Gestionar'}
                    </Button>
                    {gestionando && (
                        <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setModalCatOpen(true)} className="gap-1 text-[10px] h-7 rounded-md font-bold px-2.5">
                                <FolderPlus className="w-3.5 h-3.5" /> Categorías
                            </Button>
                            <Button size="sm" onClick={abrirNuevo} className="gap-1 text-[10px] h-7 rounded-md font-bold px-2.5">
                                <Plus className="w-3.5 h-3.5" /> Nuevo
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Grid de productos */}
            {filtrados.length === 0 ? (
                <EmptyState
                    icon={ShoppingBag}
                    title="Sin productos en esta categoría"
                    description={catActiva === 'todos' ? 'Agrega productos desde el panel de gestión para comenzar a vender.' : 'No hay productos en esta categoría. Prueba con otra categoría.'}
                    className="py-10"
                />
            ) : (
                <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 pb-20 lg:pb-4">
                    {filtrados.map(prod => {
                        const qty = cantidadEnCarrito(prod.id);
                        const stockLeft = stockDisponible(prod);
                        const sinStock = stockLeft <= 0;
                        const stockBajo = !sinStock && stockLeft <= 5;
                        return (
                            <div
                                key={prod.id}
                                onClick={() => {
                                    if (gestionando) return;
                                    if (sinStock) return;
                                    onAgregar({ ...prod, precio: prod.precio_venta });
                                }}
                                className={cn(
                                    "relative bg-card/40 hover:bg-card/60 backdrop-blur-xl border border-border/40 dark:border-white/10 rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all duration-200 ease-out select-none min-h-[110px] justify-between",
                                    !gestionando && !sinStock && "active:scale-[0.98] hover:shadow-md hover:border-primary/40 cursor-pointer",
                                    sinStock && "opacity-50 cursor-not-allowed",
                                    qty > 0 && !sinStock && "border-primary bg-primary/10 shadow-md ring-1 ring-primary/50",
                                    gestionando && "cursor-default"
                                )}
                            >
                                {qty > 0 && !gestionando && (
                                    <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                                        {qty}
                                    </span>
                                )}

                                <p className="text-xs font-extrabold text-foreground text-center leading-tight line-clamp-2 mt-0.5">{prod.nombre}</p>
                                
                                {sinStock ? (
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-destructive">Sin Stock</p>
                                ) : (
                                    <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tighter">S/ {Number(prod.precio_venta || 0).toFixed(2)}</p>
                                )}

                                {/* Badge de Stock */}
                                <div className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border",
                                    sinStock
                                        ? "bg-destructive/15 text-destructive border-destructive/20 animate-pulse"
                                        : stockBajo
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                )}>
                                    <span className={cn(
                                        "w-1 h-1 rounded-full inline-block",
                                        sinStock ? "bg-destructive" : stockBajo ? "bg-amber-500" : "bg-emerald-500"
                                    )} />
                                    {sinStock ? 'Agotado' : `Stock: ${prod.stock}`}
                                </div>

                                {gestionando && (
                                    <div className="flex gap-1 mt-1" onClick={e => e.stopPropagation()}>
                                        <button onClick={() => abrirEditar(prod)} className="p-1 rounded-md bg-secondary hover:bg-primary hover:text-primary-foreground transition-[transform,opacity]">
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => { 
                                            toast(`¿Eliminar "${prod.nombre}"?`, {
                                                action: { label: 'Eliminar', onClick: () => deleteProd.mutate(prod.id) }
                                            }); 
                                        }}
                                            className="p-1 rounded-md bg-secondary hover:bg-destructive hover:text-destructive-foreground transition-[transform,opacity]">
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
                            <Label className="text-xs">Nombre *</Label>
                            <Input className="mt-1 h-9 text-xs rounded-md" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Red Bull" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label className="text-xs">Precio S/ *</Label>
                                <Input className="mt-1 h-9 text-xs rounded-md" type="number" min="0" step="0.10" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="12.00" />
                            </div>
                            <div>
                                <Label className="text-xs">Stock Inicial *</Label>
                                <Input className="mt-1 h-9 text-xs rounded-md" type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: Number(e.target.value) })} placeholder="50" />
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs">Categoría</Label>
                            <Select value={form.categoria_id} onValueChange={v => setForm({ ...form, categoria_id: v })}>
                                <SelectTrigger className="mt-1 h-9 text-xs rounded-md"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {categoriasDb.map(c => (
                                        <SelectItem key={c.id} value={c.id} className="text-xs">{c.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="outline" className="flex-1 h-9 text-xs rounded-md" onClick={() => setModalOpen(false)}>Cancelar</Button>
                            <Button className="flex-1 h-9 text-xs rounded-md" disabled={saveProd.isPending || !form.nombre || !form.precio}
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

            {/* Modal Gestión de Categorías */}
            <Dialog open={modalCatOpen} onOpenChange={setModalCatOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Gestionar Categorías</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs">Nueva Categoría</Label>
                            <div className="flex gap-2">
                                <Input 
                                    className="h-9 text-xs rounded-md"
                                    placeholder="Ej: Bebidas Calientes" 
                                    value={nuevaCat} 
                                    onChange={e => setNuevaCat(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && nuevaCat.trim()) {
                                            saveCat.mutate({ nombre: nuevaCat.trim() });
                                        }
                                    }}
                                />
                                <Button 
                                    size="icon"
                                    className="h-9 w-9 rounded-md flex-shrink-0"
                                    disabled={saveCat.isPending || !nuevaCat.trim()}
                                    onClick={() => saveCat.mutate({ nombre: nuevaCat.trim() })}
                                >
                                    {saveCat.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                            {categoriasDb.length === 0 ? (
                                <EmptyState
                                    icon={FolderPlus}
                                    title="No hay categorías"
                                    description="Crea tu primera categoría personalizada para organizar los productos."
                                    className="py-6"
                                />
                            ) : (
                                categoriasDb.map(cat => (
                                    <div key={cat.id} className="flex items-center justify-between p-2 bg-card/50 hover:bg-muted/30 transition-colors">
                                        <span className="text-xs font-bold pl-1">{cat.nombre}</span>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                            disabled={deleteCat.isPending}
                                            onClick={() => {
                                                toast(`¿Eliminar categoría "${cat.nombre}"?`, {
                                                    action: { label: 'Eliminar', onClick: () => deleteCat.mutate(cat.id) }
                                                });
                                            }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="pt-2">
                            <Button variant="outline" className="w-full h-9 text-xs rounded-md" onClick={() => setModalCatOpen(false)}>Cerrar</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
});
CatalogoMinimarket.displayName = 'CatalogoMinimarket';
export default CatalogoMinimarket;
