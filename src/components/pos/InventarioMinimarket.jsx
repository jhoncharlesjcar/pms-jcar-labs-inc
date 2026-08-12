import { useState, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useHotelData } from '@/hooks/use-hotel-data';
import { Package, Search, Plus, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const InventarioMinimarket = memo(function InventarioMinimarket() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [search, setSearch] = useState('');
    const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
    const [modalOpen, setModalOpen] = useState(false);
    const [prodAjuste, setProdAjuste] = useState(null);
    const [cantidadAjuste, setCantidadAjuste] = useState('');
    const [tipoAjuste, setTipoAjuste] = useState('ingreso'); // 'ingreso', 'reemplazo'

    const { data: categorias = [] } = useQuery({
        queryKey: ['categorias-minimarket', hotelId],
        queryFn: () => hotelDb.CategoriaProducto.list(),
        enabled: !!hotelId,
    });

    const { data: productos = [] } = useQuery({
        queryKey: ['productos-minimarket', hotelId],
        queryFn: () => hotelDb.Producto.list(),
        enabled: !!hotelId,
    });

    const ajustarStock = useMutation({
        mutationFn: async () => {
            const stockActual = prodAjuste.stock || 0;
            const cantNum = Number(cantidadAjuste);
            const nuevoStock = tipoAjuste === 'ingreso' ? stockActual + cantNum : cantNum;
            
            return hotelDb.Producto.update(prodAjuste.id, { stock: Math.max(0, nuevoStock) });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['productos-minimarket'] });
            setModalOpen(false);
            setProdAjuste(null);
            setCantidadAjuste('');
            toast.success('Stock actualizado', { description: 'El inventario se ha actualizado correctamente.' });
        },
        onError: () => toast.error('Error', { description: 'No se pudo actualizar el stock.' })
    });

    const filtrados = productos.filter(p => {
        const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
        const matchCat = categoriaFiltro === 'todos' || p.categoria_id === categoriaFiltro;
        return matchSearch && matchCat;
    });

    const abrirAjuste = (prod) => {
        setProdAjuste(prod);
        setTipoAjuste('ingreso');
        setCantidadAjuste('');
        setModalOpen(true);
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-card/60 backdrop-blur-xl border-b border-border/50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                        <Package className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg leading-tight">Inventario de Productos</h2>
                        <p className="text-xs text-muted-foreground font-medium">{productos.length} productos registrados</p>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5 flex-1 overflow-hidden flex flex-col">
                {/* Filtros */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar producto..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-11 bg-card rounded-xl"
                        />
                    </div>
                    <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                        <SelectTrigger className="w-full sm:w-48 h-11 bg-card rounded-xl text-base sm:text-sm">
                            <SelectValue placeholder="Todas las categorías" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todas las categorías</SelectItem>
                            {categorias.map(c => (
                                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Tabla de Inventario */}
                <div className="flex-1 overflow-auto border border-border/50 rounded-2xl bg-card shadow-sm custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 sticky top-0 z-10 backdrop-blur-md">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Producto</th>
                                <th className="px-4 py-3 font-semibold">Categoría</th>
                                <th className="px-4 py-3 font-semibold text-right">Precio Venta</th>
                                <th className="px-4 py-3 font-semibold text-center">Stock</th>
                                <th className="px-4 py-3 font-semibold text-center">Estado</th>
                                <th className="px-4 py-3 font-semibold text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-12 text-center text-muted-foreground">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            ) : (
                                filtrados.map(prod => {
                                    const cat = categorias.find(c => c.id === prod.categoria_id);
                                    const stock = prod.stock || 0;
                                    let estadoBadge = '';
                                    if (stock === 0) estadoBadge = <span className="bg-destructive/10 text-destructive text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-max mx-auto"><AlertTriangle className="w-3 h-3"/> Agotado</span>;
                                    else if (stock <= 5) estadoBadge = <span className="bg-amber-500/10 text-amber-600 text-xs px-2 py-0.5 rounded-full font-bold w-max mx-auto">Bajo Stock</span>;
                                    else estadoBadge = <span className="bg-green-500/10 text-green-600 text-xs px-2 py-0.5 rounded-full font-bold w-max mx-auto">Normal</span>;

                                    return (
                                        <tr key={prod.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-foreground text-sm">{prod.nombre}</p>
                                            </td>
                                            <td className="px-4 py-3 text-muted-foreground text-xs">{cat?.nombre || 'Sin Categoría'}</td>
                                            <td className="px-4 py-3 text-right font-medium">S/ {Number(prod.precio_venta || 0).toFixed(2)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="font-display font-black text-base">{stock}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">{estadoBadge}</td>
                                            <td className="px-4 py-3 text-center">
                                                <Button size="sm" variant="outline" onClick={() => abrirAjuste(prod)} className="h-8 gap-1 rounded-lg text-xs">
                                                    <ArrowUpCircle className="w-3.5 h-3.5" /> Ajustar
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Ajuste */}
            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Ajustar Stock</DialogTitle>
                    </DialogHeader>
                    {prodAjuste && (
                        <div className="space-y-4 pt-2">
                            <div className="p-3 bg-secondary/20 rounded-xl flex items-center justify-between border border-border/50">
                                <div>
                                    <p className="font-bold text-sm text-foreground">{prodAjuste.nombre}</p>
                                    <p className="text-xs text-muted-foreground">Stock actual: {prodAjuste.stock || 0}</p>
                                </div>
                                <div className="w-10 h-10 bg-card rounded-lg shadow-sm flex items-center justify-center font-display font-black text-primary border border-border">
                                    {prodAjuste.stock || 0}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    type="button"
                                    variant={tipoAjuste === 'ingreso' ? 'default' : 'outline'} 
                                    className="h-9"
                                    onClick={() => setTipoAjuste('ingreso')}
                                >
                                    Ingreso (+ sumar)
                                </Button>
                                <Button 
                                    type="button"
                                    variant={tipoAjuste === 'reemplazo' ? 'default' : 'outline'}
                                    className="h-9"
                                    onClick={() => setTipoAjuste('reemplazo')}
                                >
                                    Fijar Real (=)
                                </Button>
                            </div>

                            <div>
                                <Label>Cantidad {tipoAjuste === 'ingreso' ? 'a ingresar' : 'real en almacén'}</Label>
                                <Input 
                                    className="mt-1 text-base sm:text-sm" 
                                    type="number" 
                                    min="0" 
                                    value={cantidadAjuste} 
                                    onChange={(e) => setCantidadAjuste(e.target.value)} 
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancelar</Button>
                                <Button className="flex-1 gap-2" onClick={() => ajustarStock.mutate()} disabled={!cantidadAjuste || ajustarStock.isPending}>
                                    <Plus className="w-4 h-4" /> Guardar
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
});
InventarioMinimarket.displayName = 'InventarioMinimarket';
export default InventarioMinimarket;
