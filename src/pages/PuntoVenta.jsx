import { useState } from 'react';
import { ShoppingCart, Receipt, RotateCcw, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CatalogoMinimarket from '@/components/pos/CatalogoMinimarket';
import CarritoMinimarket from '@/components/pos/CarritoMinimarket';
import PagoModal from '@/components/pos/PagoModal';
import { motion } from 'framer-motion';

export default function PuntoVenta() {
    const [items, setItems] = useState([]);
    const [pagoOpen, setPagoOpen] = useState(false);
    const [vistaMovil, setVistaMovil] = useState('catalogo'); // 'catalogo' | 'carrito'

    const agregarItem = (producto) => {
        setItems(prev => {
            const idx = prev.findIndex(i => i.id === producto.id);
            if (idx >= 0) {
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
        <div className="flex flex-col lg:flex-row -m-4 lg:-m-8 min-h-screen bg-background">

            {/* ===== PANEL IZQUIERDO: CATÁLOGO ===== */}
            <div className={`flex-1 flex flex-col ${vistaMovil === 'catalogo' ? 'flex' : 'hidden'} lg:flex`}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-card/60 backdrop-blur-xl border-b border-border/50 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-primary/15 rounded-xl flex items-center justify-center border border-primary/20 shadow-sm">
                            <Store className="w-4.5 h-4.5 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-bold text-foreground text-base leading-tight">Minimarket</h1>
                            <p className="text-[10px] text-muted-foreground font-medium">Toca un producto para agregar</p>
                        </div>
                    </div>
                    {items.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={limpiarCarrito} className="text-muted-foreground hover:text-destructive gap-1.5 text-xs rounded-xl">
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
            <div className={`w-full lg:w-80 xl:w-96 flex flex-col bg-card/60 backdrop-blur-xl border-l border-border/50 ${vistaMovil === 'carrito' ? 'flex' : 'hidden'} lg:flex`}>
                <div className="px-5 py-4 border-b border-border/50 bg-card/40 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <ShoppingCart className="w-4 h-4 text-primary" />
                            <span className="font-bold text-foreground text-sm">Carrito</span>
                            {totalItems > 0 && (
                                <motion.span 
                                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                                    className="bg-primary text-primary-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm"
                                >
                                    {totalItems}
                                </motion.span>
                            )}
                        </div>
                        {/* botón volver al catálogo en móvil */}
                        <button onClick={() => setVistaMovil('catalogo')} className="lg:hidden text-xs text-primary font-bold hover:underline">
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
                <div className="p-5 border-t border-border/50 bg-card/40 backdrop-blur-xl space-y-3">
                    {items.length > 0 && (
                        <div className="flex justify-between items-center font-bold text-foreground px-1">
                            <span className="text-sm text-muted-foreground uppercase tracking-wider">Total</span>
                            <span className="text-2xl font-display text-primary">S/ {totalGeneral.toFixed(2)}</span>
                        </div>
                    )}
                    <Button
                        className="w-full h-14 text-base gap-2.5 font-bold rounded-2xl shadow-xl shadow-primary/20 transition-all"
                        disabled={items.length === 0}
                        onClick={() => setPagoOpen(true)}
                    >
                        <Receipt className="w-5 h-5" />
                        {items.length > 0 ? `Cobrar S/ ${totalGeneral.toFixed(2)}` : 'Carrito vacío'}
                    </Button>
                </div>
            </div>

            {/* ===== BARRA INFERIOR MÓVIL ===== */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-2xl border-t border-border/50 flex z-20 safe-bottom">
                <button
                    onClick={() => setVistaMovil('catalogo')}
                    className={`flex-1 flex flex-col items-center py-3 text-xs font-bold transition-colors ${vistaMovil === 'catalogo' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                    <Store className="w-5 h-5 mb-0.5" />
                    Productos
                </button>
                <button
                    onClick={() => setVistaMovil('carrito')}
                    className={`flex-1 flex flex-col items-center py-3 text-xs font-bold transition-colors relative ${vistaMovil === 'carrito' ? 'text-primary' : 'text-muted-foreground'}`}
                >
                    <ShoppingCart className="w-5 h-5 mb-0.5" />
                    Carrito
                    {totalItems > 0 && (
                        <span className="absolute top-1.5 right-1/4 bg-destructive text-destructive-foreground text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                            {totalItems > 9 ? '9+' : totalItems}
                        </span>
                    )}
                </button>
                {items.length > 0 && (
                    <button
                        onClick={() => setPagoOpen(true)}
                        className="flex-1 flex flex-col items-center py-3 text-xs font-black text-primary"
                    >
                        <Receipt className="w-5 h-5 mb-0.5" />
                        Cobrar
                    </button>
                )}
            </div>

            {/* Espacio para barra inferior en móvil */}
            <div className="lg:hidden h-16" />

            <PagoModal
                open={pagoOpen}
                onClose={() => setPagoOpen(false)}
                resumen={resumenPago}
                reservaSeleccionada={null}
                onExito={limpiarCarrito}
            />
        </div>
    );
}