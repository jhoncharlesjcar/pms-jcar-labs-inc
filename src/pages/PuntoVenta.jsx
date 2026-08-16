import { useState, memo } from 'react';
import { ShoppingCart, Receipt, RotateCcw, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CatalogoMinimarket from '@/components/pos/CatalogoMinimarket';
import CarritoMinimarket from '@/components/pos/CarritoMinimarket';
import PagoModal from '@/components/pos/PagoModal';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';


const PuntoVenta = memo(function PuntoVenta() {
    const [items, setItems] = useState([]);
    const [pagoOpen, setPagoOpen] = useState(false);
    const [vistaMovil, setVistaMovil] = useState('catalogo'); // 'catalogo' | 'carrito'

    // ─── Stagger mount para secciones principales ───
    const pageRef = useGsapStaggerList([], {
        stagger: 0.08,
        direction: 'y',
        distance: 15,
    });

    const agregarItem = (producto) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === producto.id);
            if (idx >= 0) {
                const itemActual = prev[idx];
                // No agregar más de lo que hay en stock
                if (itemActual.cantidad >= (producto.stock || 999)) return prev;
                const copia = [...prev];
                copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 };
                return copia;
            }
            return [...prev, { ...producto, cantidad: 1 }];
        });
    };

    const cambiarCantidad = (idx, nuevaCantidad) => {
        if (nuevaCantidad <= 0) {
            setItems(prev => prev.filter((_, i) => i !== idx));
        } else {
            setItems(prev => prev.map((item, i) => i === idx ? { ...item, cantidad: nuevaCantidad } : item));
        }
    };

    const eliminarItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));
    const limpiarCarrito = () => { setItems([]); };

    const totalItems = items.reduce((s, i) => s + i.cantidad, 0);
    const totalGeneral = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    // PagoModal espera este formato
    const resumenPago = {
        items,
        subtotalEstadia: 0,
        subtotalExtras: totalGeneral,
        total: totalGeneral,
    };

    return (
        <div className="-m-4 flex min-h-[calc(100dvh-4rem)] flex-col bg-background sm:-m-5 lg:-m-7 lg:min-h-screen lg:flex-row xl:-m-8">
            <div ref={pageRef} className="flex flex-1 flex-col lg:flex-row">

            {/* ===== PANEL IZQUIERDO: CATÁLOGO ===== */}
            <div className={`flex-1 flex flex-col ${vistaMovil === 'catalogo' ? 'flex' : 'hidden'} lg:flex`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-card/40 backdrop-blur-xl border-b border-border/40 flex-shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg flex items-center justify-center shadow-sm">
                            <Store className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-extrabold text-foreground text-xl sm:text-2xl tracking-tight leading-none">Punto de Venta</h1>
                            <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-widest mt-0.5">POS y Minimarket</p>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={limpiarCarrito} className="gap-1.5 px-2.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                            <RotateCcw className="w-3 h-3" /> Limpiar
                        </Button>
                    )}
                </div>

                {/* Catálogo scrolleable */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <CatalogoMinimarket onAgregar={agregarItem} itemsEnCarrito={items} />
                </div>
            </div>

            {/* ===== PANEL DERECHO: CARRITO ===== */}
            <div className={`w-full lg:w-72 xl:w-[380px] flex flex-col bg-card/40 backdrop-blur-xl border-l border-border/40 ${vistaMovil === 'carrito' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="px-4 py-3 border-b border-border/40 bg-card/20 flex-shrink-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-primary/10 rounded-md text-primary">
                                <ShoppingCart className="w-3.5 h-3.5" />
                            </div>
                            <span className="font-extrabold text-foreground text-sm tracking-tight">Carrito</span>
                            {totalItems > 0 && (
                                <span className="bg-primary text-primary-foreground text-[9px] font-bold px-1.5 py-0.5 rounded-sm flex items-center justify-center shadow-xs ml-1">
                                    {totalItems} ítems
                                </span>
                            )}
                        </div>
                        {/* botón volver al catálogo en móvil */}
                        <button onClick={() => setVistaMovil('catalogo')} className="lg:hidden text-[10px] text-primary font-bold hover:underline">
                            ← Catálogo
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <CarritoMinimarket
                        items={items}
                        onCambiarCantidad={cambiarCantidad}
                        onEliminar={eliminarItem}
                    />
                </div>

                {/* Cobrar */}
                <div className="p-4 border-t border-border/40 bg-card/40 backdrop-blur-xl space-y-3">
                    {items.length > 0 && (
                        <div className="flex justify-between items-end font-bold text-foreground px-1 mb-1">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black">Total a cobrar</span>
                            <span className="text-2xl font-extrabold text-primary tabular-nums tracking-tighter leading-none">S/ {totalGeneral.toFixed(2)}</span>
                        </div>
                    )}
                    <Button
                        className="w-full gap-1.5 text-xs"
                        disabled={items.length === 0}
                        onClick={() => setPagoOpen(true)}
                    >
                        <Receipt className="w-3.5 h-3.5" />
                        {items.length > 0 ? `Procesar Pago` : 'Carrito vacío'}
                    </Button>
                </div>
            </div>

            {/* ===== BARRA INFERIOR MÓVIL ===== */}
            <nav aria-label="Acciones del punto de venta" className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-2xl border-t border-border/60 flex items-center justify-around z-50 safe-bottom p-1.5 shadow-lg">
                <button
                    onClick={() => setVistaMovil('catalogo')}
                    className={`flex-1 min-h-[40px] flex flex-col items-center justify-center text-[10px] font-bold transition-all rounded-lg ${vistaMovil === 'catalogo' ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                >
                    <Store className="w-3.5 h-3.5 mb-0.5" />
                    <span>Productos</span>
                </button>
                <button
                    onClick={() => setVistaMovil('carrito')}
                    className={`flex-1 min-h-[40px] flex flex-col items-center justify-center text-[10px] font-bold transition-all rounded-lg relative ${vistaMovil === 'carrito' ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                >
                    <ShoppingCart className="w-3.5 h-3.5 mb-0.5" />
                    <span>Carrito</span>
                    {totalItems > 0 && (
                        <span className="absolute top-1 right-1/4 bg-primary text-primary-foreground text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-xs">
                            {totalItems > 9 ? '9+' : totalItems}
                        </span>
                    )}
                </button>
                {items.length > 0 && (
                    <button
                        onClick={() => setPagoOpen(true)}
                        className="flex-1 min-h-[40px] flex flex-col items-center justify-center text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all active:scale-95"
                    >
                        <Receipt className="w-3.5 h-3.5 mb-0.5" />
                        <span>S/ {totalGeneral.toFixed(2)}</span>
                    </button>
                )}
            </nav>

            {/* Espacio para barra inferior en móvil */}
            <div className="lg:hidden h-16" />
            </div>

            <PagoModal
                open={pagoOpen}
                onClose={() => setPagoOpen(false)}
                resumen={resumenPago}
                reservaSeleccionada={null}
                onExito={limpiarCarrito}
            />
        </div>
    );
});
PuntoVenta.displayName = 'PuntoVenta';
export default PuntoVenta;
