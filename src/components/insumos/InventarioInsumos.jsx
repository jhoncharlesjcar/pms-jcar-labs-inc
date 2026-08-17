import { useState, useMemo, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { useHotel } from '@/contexts/HotelContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
    Package, Plus, Minus, History, AlertTriangle, 
    ArrowRightLeft, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { format } from 'date-fns';

const Insumos = memo(function Insumos() {
    const { hotelActual } = useHotel();
    const { user } = useAuth();
    const qc = useQueryClient();
    const hotelDb = db.forHotel(hotelActual?.id);

    const [modalInsumo, setModalInsumo] = useState(false);
    const [modalMovimiento, setModalMovimiento] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState('entrada'); // 'entrada' o 'salida'
    const [insumoSeleccionado, setInsumoSeleccionado] = useState(null);

    // --- DATA FETCHING ---
    const { data: categorias = [] } = useQuery({
        queryKey: ['categorias_insumos', hotelActual?.id],
        queryFn: () => hotelDb.CategoriaInsumo.list(),
        enabled: !!hotelActual?.id
    });

    const { data: insumos = [] } = useQuery({
        queryKey: ['insumos', hotelActual?.id],
        queryFn: () => hotelDb.Insumo.list(),
        enabled: !!hotelActual?.id
    });

    const { data: movimientos = [] } = useQuery({
        queryKey: ['movimientos_insumos', hotelActual?.id],
        queryFn: () => hotelDb.MovimientoInsumo.list(),
        enabled: !!hotelActual?.id
    });

    // --- MUTATIONS ---
    const addCategoria = useMutation({
        mutationFn: (/** @type {any} */ nombre) => hotelDb.CategoriaInsumo.create({ nombre }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['categorias_insumos'] })
    });

    const addInsumo = useMutation({
        mutationFn: (/** @type {any} */ vars) => hotelDb.Insumo.create(vars),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['insumos'] });
            setModalInsumo(false);
        }
    });

    const addMovimiento = useMutation({
        mutationFn: async (/** @type {any} */ vars) => {
            // 1. Crear el movimiento
            const mov = await hotelDb.MovimientoInsumo.create(vars);
            // 2. Actualizar el stock del insumo
            const insumo = insumos.find(i => i.id === vars.insumo_id);
            const nuevoStock = vars.tipo_movimiento === 'entrada' 
                ? insumo.stock + Number(vars.cantidad)
                : insumo.stock - Number(vars.cantidad);
            
            await hotelDb.Insumo.update(vars.insumo_id, { stock: nuevoStock });

            // 3. Si es una compra (entrada con costo), crear egreso en caja
            if (vars.tipo_movimiento === 'entrada' && Number(vars.costo_total) > 0) {
                await hotelDb.Egreso.create({
                    monto: Number(vars.costo_total),
                    concepto: `Compra de insumo: ${insumo.nombre} (${vars.cantidad} ${insumo.unidad_medida}) - ${vars.motivo}`,
                    categoria: 'insumos',
                    fecha: new Date().toISOString(),
                    usuario_id: user?.id,
                    usuario_nombre: user?.full_name || user?.email
                });
                qc.invalidateQueries({ queryKey: ['egresos'] });
            }

            return mov;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['insumos'] });
            qc.invalidateQueries({ queryKey: ['movimientos_insumos'] });
            setModalMovimiento(false);
            setInsumoSeleccionado(null);
        }
    });

    const removeInsumo = useMutation({
        mutationFn: (/** @type {any} */ id) => hotelDb.Insumo.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] })
    });

    // --- HANDLERS ---
    const handleCrearInsumo = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const cat = fd.get('categoria_id');
        let catId = cat;

        // Crear categoría si es "nueva" (simplificado para UI rapida)
        if (cat === 'nueva') {
            const nuevaCat = window.prompt("Nombre de la nueva categoría (ej. Limpieza, Baño):");
            if (!nuevaCat) return;
            addCategoria.mutate(nuevaCat, {
                onSuccess: (/** @type {any} */ data) => {
                    addInsumo.mutate({
                        nombre: fd.get('nombre'),
                        categoria_id: data.id,
                        unidad_medida: fd.get('unidad_medida'),
                        stock: 0
                    });
                }
            });
            return;
        }

        addInsumo.mutate({
            nombre: fd.get('nombre'),
            categoria_id: catId,
            unidad_medida: fd.get('unidad_medida'),
            stock: 0
        });
    };

    const handleMovimiento = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const costo = fd.get('costo_total');
        
        addMovimiento.mutate({
            insumo_id: insumoSeleccionado.id,
            tipo_movimiento: tipoMovimiento,
            cantidad: Number(fd.get('cantidad')),
            costo_total: tipoMovimiento === 'entrada' ? Number(costo || 0) : 0,
            motivo: fd.get('motivo'),
            usuario_nombre: user?.full_name || user?.email
        });
    };

    const abrirMovimiento = (insumo, tipo) => {
        setInsumoSeleccionado(insumo);
        setTipoMovimiento(tipo);
        setModalMovimiento(true);
    };

    // --- STATS ---
    const stats = useMemo(() => {
        const total = insumos.length;
        const bajoStock = insumos.filter(i => i.stock < 5).length;
        const mHoy = movimientos.filter(m => {
            const f = new Date(m.created_date).toLocaleDateString();
            return f === new Date().toLocaleDateString();
        });
        const entradasHoy = mHoy.filter(m => m.tipo_movimiento === 'entrada').length;
        const salidasHoy = mHoy.filter(m => m.tipo_movimiento === 'salida').length;

        return { total, bajoStock, entradasHoy, salidasHoy };
    }, [insumos, movimientos]);

    return (
        <div className="pt-1 sm:pt-2 pb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-5 page-enter">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 shadow-xs">
                            <Package className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">Insumos y Suministros</h1>
                            <p className="text-muted-foreground text-[10px] sm:text-xs font-bold uppercase tracking-widest mt-0.5">
                                Controla el stock interno de tu propiedad
                            </p>
                        </div>
                    </div>
                </div>
                <div>
                    <Button onClick={() => setModalInsumo(true)} className="gap-1.5 h-9 rounded-md font-extrabold text-xs px-4 shadow-md active:scale-95 transition-all">
                        <Plus className="w-3.5 h-3.5" />
                        Nuevo Insumo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 group-hover:scale-105 transition-transform">
                            <Package className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">General</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-0.5 tabular-nums text-foreground tracking-tighter leading-none">{stats.total}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Ítems Registrados</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
                </div>

                <div className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:scale-105 transition-transform">
                            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Alerta</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-0.5 tabular-nums text-red-600 dark:text-red-400 tracking-tighter leading-none">{stats.bajoStock}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Stock Bajo ({'<5'})</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-red-500/10 transition-colors" />
                </div>

                <div className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-105 transition-transform">
                            <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">Entradas</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-0.5 tabular-nums text-emerald-600 dark:text-emerald-400 tracking-tighter leading-none">{stats.entradasHoy}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Ingresos Hoy</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-emerald-500/10 transition-colors" />
                </div>

                <div className="bg-card/40 backdrop-blur-xl border border-border/40 p-4 rounded-xl shadow-sm relative overflow-hidden group hover:-translate-y-1 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-105 transition-transform">
                            <History className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">Salidas</span>
                    </div>
                    <p className="text-2xl font-extrabold mb-0.5 tabular-nums text-amber-600 dark:text-amber-400 tracking-tighter leading-none">{stats.salidasHoy}</p>
                    <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Salidas Hoy</p>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition-colors" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                {/* INVENTARIO */}
                <div className="lg:col-span-2 space-y-4">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary" />
                        Inventario Actual
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {insumos.map(insumo => {
                            const cat = categorias.find(c => c.id === insumo.categoria_id);
                            const esBajo = insumo.stock <= 5;
                            return (
                                <div key={insumo.id} className="bg-card/40 backdrop-blur-xl p-4 rounded-xl relative overflow-hidden border border-border/40 hover:border-primary/40 transition-all shadow-sm space-y-3 group hover:-translate-y-1 hover:shadow-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <span className="text-[8px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded inline-block mb-2 border border-primary/20 shadow-xs">
                                                {cat?.nombre || 'General'}
                                            </span>
                                            <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-foreground leading-tight">{insumo.nombre}</h3>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn("text-2xl font-black tabular-nums tracking-tighter leading-none", esBajo ? "text-red-600 dark:text-red-400" : "text-foreground")}>
                                                {insumo.stock}
                                            </p>
                                            <p className="text-[8px] text-muted-foreground font-black uppercase tracking-widest mt-1 bg-muted/50 px-1.5 py-0.5 rounded inline-block shadow-xs border border-border/40">{insumo.unidad_medida}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 pt-2 border-t border-border/40">
                                        <Button 
                                            variant="outline" size="sm" 
                                            className="flex-1 h-8 rounded-lg gap-1 px-1.5 text-[9px] font-extrabold uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 border-border/40 active:scale-95 transition-all shadow-xs"
                                            onClick={() => abrirMovimiento(insumo, 'entrada')}
                                        >
                                            <Plus className="w-3 h-3" /> Ingreso
                                        </Button>
                                        <Button 
                                            variant="outline" size="sm" 
                                            className="flex-1 h-8 rounded-lg gap-1 px-1.5 text-[9px] font-extrabold uppercase tracking-widest hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 border-border/40 active:scale-95 transition-all shadow-xs"
                                            onClick={() => abrirMovimiento(insumo, 'salida')}
                                        >
                                            <Minus className="w-3 h-3" /> Salida
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => removeInsumo.mutate(insumo.id)} className="shrink-0 h-8 w-8 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 active:scale-95 transition-all border border-transparent hover:border-red-500/20">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                        {insumos.length === 0 && (
                            <div className="col-span-full py-16 text-center text-muted-foreground bg-card/20 border border-dashed border-border/40 rounded-[2rem]">
                                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4 border border-border/50">
                                    <Package className="w-8 h-8 opacity-50" />
                                </div>
                                <p className="text-base font-extrabold text-foreground tracking-tight">No hay insumos registrados</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-2">Presiona "Nuevo Insumo" para comenzar tu inventario.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* HISTORIAL */}
                <div className="space-y-4">
                    <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                        <History className="w-5 h-5 text-muted-foreground" />
                        Movimientos Recientes
                    </h2>
                    <div className="space-y-3">
                        {movimientos.slice(0, 15).map(mov => {
                            const isEntrada = mov.tipo_movimiento === 'entrada';
                            const insumo = insumos.find(i => i.id === mov.insumo_id);
                            return (
                                <div key={mov.id} className="bg-card/40 backdrop-blur-xl p-3 rounded-xl border border-border/40 flex items-center gap-3 shadow-sm group hover:-translate-y-0.5 hover:shadow-md transition-all">
                                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 shadow-xs group-hover:scale-105 transition-transform", 
                                        isEntrada ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                                    )}>
                                        {isEntrada ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-extrabold text-xs truncate text-foreground tracking-tight">{insumo?.nombre || 'Desconocido'}</p>
                                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">
                                            <span className={cn("font-extrabold tabular-nums", isEntrada ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>{isEntrada ? '+' : '-'}{mov.cantidad} {insumo?.unidad_medida || 'unids'}</span>
                                            <span className="opacity-30">•</span>
                                            <span className="truncate">{mov.motivo}</span>
                                        </div>
                                        <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground mt-1 bg-muted/50 inline-block px-1.5 py-0.5 rounded border border-border/40 shadow-xs">{format(new Date(mov.created_date), "dd/MM HH:mm")} por {mov.usuario_nombre}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {movimientos.length === 0 && (
                            <p className="text-center text-xs font-bold uppercase tracking-widest text-muted-foreground py-10 bg-card/20 border border-dashed border-border/40 rounded-2xl">No hay movimientos recientes</p>
                        )}
                    </div>
                </div>
            </div>

            <Dialog open={modalInsumo} onOpenChange={setModalInsumo}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-xl glass-panel border border-border/80 shadow-2xl">
                    <div className="bg-primary/10 p-6 relative overflow-hidden border-b border-primary/20">
                        <DialogHeader>
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mb-3 shadow-sm text-primary-foreground">
                                <Package className="w-5 h-5" />
                            </div>
                            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">Nuevo Insumo</DialogTitle>
                        </DialogHeader>
                        <DialogDescription className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">Añade un suministro al inventario interno del hotel.</DialogDescription>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
                    </div>
                    
                    <form onSubmit={handleCrearInsumo} className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Nombre del Insumo</Label>
                            <Input name="nombre" required placeholder="Ej. Papel Higiénico Scott" className="h-10 rounded-md text-xs font-bold bg-background/50 border-border/40 focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-inner px-3" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Categoría</Label>
                                <select name="categoria_id" required className="w-full h-10 px-3 rounded-md border border-border/40 bg-background/50 text-xs font-bold focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-sm appearance-none cursor-pointer">
                                    <option value="">Seleccione...</option>
                                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    <option value="nueva">+ Crear nueva...</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Unidad de Medida</Label>
                                <select name="unidad_medida" required className="w-full h-10 px-3 rounded-md border border-border/40 bg-background/50 text-xs font-bold focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-sm appearance-none cursor-pointer">
                                    <option value="unidad">Unidades</option>
                                    <option value="litro">Litros (L)</option>
                                    <option value="galon">Galones</option>
                                    <option value="rollo">Rollos</option>
                                    <option value="paquete">Paquetes</option>
                                    <option value="kg">Kilogramos (kg)</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setModalInsumo(false)} className="flex-1 h-9 rounded-md font-bold text-xs uppercase tracking-widest">Cancelar</Button>
                            <Button type="submit" disabled={addInsumo.isPending} className="flex-1 h-9 rounded-md bg-primary hover:bg-primary/90 shadow-md font-extrabold text-xs active:scale-95 transition-all text-white">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={modalMovimiento} onOpenChange={setModalMovimiento}>
                <DialogContent className="max-w-md p-0 overflow-hidden rounded-xl bg-card/80 backdrop-blur-3xl border border-border/40 shadow-2xl">
                    <div className={cn("p-6 relative overflow-hidden border-b", 
                        tipoMovimiento === 'entrada' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"
                    )}>
                        <DialogHeader>
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3 shadow-sm text-white",
                                tipoMovimiento === 'entrada' ? "bg-emerald-500" : "bg-amber-500"
                            )}>
                                {tipoMovimiento === 'entrada' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                            </div>
                            <DialogTitle className="text-xl font-extrabold text-foreground tracking-tight">
                                {tipoMovimiento === 'entrada' ? 'Ingreso de Insumos' : 'Salida de Insumos'}
                            </DialogTitle>
                        </DialogHeader>
                        <DialogDescription className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mt-1">
                            {tipoMovimiento === 'entrada' 
                                ? `Añadiendo stock a: ${insumoSeleccionado?.nombre}`
                                : `Retirando stock de: ${insumoSeleccionado?.nombre} (Stock actual: ${insumoSeleccionado?.stock})`
                            }
                        </DialogDescription>
                        <div className={cn("absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16", 
                            tipoMovimiento === 'entrada' ? "bg-emerald-500/10" : "bg-amber-500/10"
                        )} />
                    </div>

                    <form onSubmit={handleMovimiento} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cantidad ({insumoSeleccionado?.unidad_medida})</Label>
                                <Input 
                                    name="cantidad" type="number" required min="1" 
                                    max={tipoMovimiento === 'salida' ? insumoSeleccionado?.stock : undefined}
                                    className="h-10 rounded-md font-extrabold text-sm bg-background/50 border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-center tabular-nums" 
                                />
                            </div>
                            {tipoMovimiento === 'entrada' && (
                                <div className="space-y-2">
                                    <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Costo Total (S/)</Label>
                                    <Input 
                                        name="costo_total" type="number" step="0.01" min="0" required
                                        placeholder="0.00"
                                        className="h-10 rounded-md font-extrabold text-sm bg-background/50 border-emerald-500/30 focus-visible:border-emerald-500/50 focus-visible:ring-emerald-500/30 shadow-inner px-3 text-center tabular-nums" 
                                    />
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Motivo / Observación</Label>
                            <Input 
                                name="motivo" required 
                                placeholder={tipoMovimiento === 'entrada' ? "Ej. Compra en Sodimac" : "Ej. Usado para limpieza de habitaciones"}
                                className="h-10 rounded-md text-xs font-bold bg-background/50 border-border/40 shadow-sm px-3" 
                            />
                        </div>
                        <div className="pt-4 flex gap-3">
                            <Button type="button" variant="outline" onClick={() => setModalMovimiento(false)} className="flex-1 h-9 rounded-md font-bold text-xs uppercase tracking-widest">Cancelar</Button>
                            <Button type="submit" disabled={addMovimiento.isPending} className={cn("flex-1 h-9 rounded-md shadow-md font-extrabold text-xs active:scale-95 transition-all text-white",
                                tipoMovimiento === 'entrada' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-amber-500 hover:bg-amber-600"
                            )}>
                                {addMovimiento.isPending ? 'Guardando...' : 'Confirmar'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
});
Insumos.displayName = 'Insumos';
export default Insumos;
