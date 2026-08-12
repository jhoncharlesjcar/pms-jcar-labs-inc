import { useRef, useEffect, memo } from 'react';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { gsap } from 'gsap';
import EmptyState from '@/components/common/EmptyState';

const EMOJI_DEFAULT = {
    bebidas: '🥤', snacks: '🍿', lacteos: '🥛', higiene: '🧴',
    licores: '🍺', cigarros: '🚬', otros: '📦',
};

/**
 * @param {Object} props
 * @param {any[]} props.items
 * @param {(id: string, dir: 'inc' | 'dec') => void} props.onCambiarCantidad
 * @param {(id: string) => void} props.onEliminar
 */
const CarritoMinimarket = memo(function CarritoMinimarket({ items, onCambiarCantidad, onEliminar }) {
    const listRef = useRef(null);
    const prevLengthRef = useRef(0);

    // GSAP stagger en items del carrito — solo anima el último item agregado
    useEffect(() => {
        if (!listRef.current) return;
        const children = listRef.current.children;
        if (children.length === 0) return;

        // Detectar si se agregó un item nuevo (no en primera carga)
        const isNewItem = prevLengthRef.current > 0 && children.length > prevLengthRef.current;
        prevLengthRef.current = children.length;

        if (isNewItem) {
            // Animar solo el último hijo (el nuevo), sin afectar existentes
            const lastChild = children[children.length - 1];
            if (lastChild) {
                gsap.fromTo(
                    lastChild,
                    { opacity: 0, x: 20 },
                    {
                        opacity: 1,
                        x: 0,
                        duration: 0.35,
                        ease: 'power3.out',
                    }
                );
            }
        }
    }, [items.length]);

    if (items.length === 0) {
        return (
            <EmptyState
                icon={ShoppingBag}
                title="Carrito vacío"
                description="Toca un producto del catálogo para agregarlo al carrito."
                className="py-6 h-32"
            />
        );
    }

    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    return (
        <div ref={listRef} className="divide-y divide-border">
            {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/10 transition-colors">
                    {/* Emoji */}
                    <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-border/40 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-base drop-shadow-sm">
                            {item.emoji || EMOJI_DEFAULT[item.categoria] || '📦'}
                        </span>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-foreground leading-tight truncate">{item.nombre}</p>
                        <p className="text-[9px] text-muted-foreground font-bold tracking-widest uppercase mt-0.5">S/ {item.precio.toFixed(2)} c/u</p>
                    </div>

                    {/* Controles cantidad */}
                    <div className="flex items-center gap-1 flex-shrink-0 bg-background/50 p-0.5 rounded-lg border border-border/60 shadow-xs">
                        <button
                            onClick={() => onCambiarCantidad(idx, item.cantidad - 1)}
                            className="w-6 h-6 rounded-md bg-card hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center shadow-xs transition-colors active:scale-90"
                        >
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-extrabold text-foreground tabular-nums">{item.cantidad}</span>
                        <button
                            onClick={() => onCambiarCantidad(idx, item.cantidad + 1)}
                            className="w-6 h-6 rounded-md bg-card hover:bg-primary hover:text-primary-foreground flex items-center justify-center shadow-xs transition-colors active:scale-90"
                        >
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Subtotal + eliminar */}
                    <div className="text-right flex-shrink-0 min-w-[60px] flex flex-col items-end">
                        <p className="text-xs font-extrabold text-foreground tabular-nums tracking-tighter">S/ {(item.precio * item.cantidad).toFixed(2)}</p>
                        <button onClick={() => onEliminar(idx)} className="text-muted-foreground hover:text-destructive transition-colors p-1 -mr-1 mt-0.5 opacity-0 group-hover:opacity-100">
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            ))}

            {/* Resumen */}
            <div className="px-4 py-3 bg-muted/20 border-t border-border/40">
                <div className="flex justify-between text-[9px] uppercase font-bold tracking-widest text-muted-foreground mb-1.5">
                    <span>{items.reduce((s, i) => s + i.cantidad, 0)} ítems físicos</span>
                    <span>{items.length} tipos de prod.</span>
                </div>
                <div className="flex justify-between font-extrabold text-foreground items-end">
                    <span className="text-xs">Subtotal Estimado</span>
                    <span className="text-base tabular-nums tracking-tighter">S/ {total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
});
CarritoMinimarket.displayName = 'CarritoMinimarket';
export default CarritoMinimarket;