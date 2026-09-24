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
 * @param {(id: number, cant: number) => void} props.onCambiarCantidad
 * @param {(idx: number) => void} props.onEliminar
 */
const CarritoMinimarket = memo(function CarritoMinimarket(/** @type {any} */ { items, onCambiarCantidad, onEliminar }) {
    const listRef = useRef(null);
    const prevLengthRef = useRef(0);

    // GSAP microinteracción al ingresar un ítem nuevo al carrito
    useEffect(() => {
        if (!listRef.current) return;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const children = listRef.current.children;
        if (children.length === 0) return;

        const isNewItem = prevLengthRef.current > 0 && children.length > prevLengthRef.current;
        prevLengthRef.current = children.length;

        if (isNewItem) {
            const lastChild = children[children.length - 1];
            if (lastChild) {
                gsap.fromTo(
                    lastChild,
                    { opacity: 0, x: 12 },
                    {
                        opacity: 1,
                        x: 0,
                        duration: 0.2,
                        ease: 'power2.out',
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

    const total = items.reduce((s, i) => s + Number(i.precio || 0) * Number(i.cantidad || 0), 0);

    return (
        <div className="flex flex-col h-full justify-between">
            <div ref={listRef} className="divide-y divide-border/60">
                {items.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-muted/10 transition-colors">
                        {/* Emoji */}
                        <div className="w-9 h-9 rounded-lg bg-secondary/50 border border-border/40 flex items-center justify-center shrink-0 shadow-xs">
                            <span className="text-base drop-shadow-sm">
                                {item.emoji || EMOJI_DEFAULT[item.categoria] || '📦'}
                            </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-extrabold text-foreground leading-tight truncate">{item.nombre}</p>
                            <p className="text-xs text-muted-foreground font-bold tracking-wider uppercase mt-0.5">S/ {item.precio.toFixed(2)} c/u</p>
                        </div>

                        {/* Controles de cantidad táctiles (WCAG 44px) */}
                        <div className="flex items-center gap-1.5 shrink-0 bg-muted/60 p-1 rounded-xl border border-border/50">
                            <button
                                type="button"
                                onClick={() => onCambiarCantidad(idx, item.cantidad - 1)}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-card hover:bg-destructive hover:text-destructive-foreground active:scale-95 flex items-center justify-center shadow-xs transition-all text-foreground"
                                title="Disminuir cantidad"
                                aria-label="Disminuir cantidad"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-6 text-center text-sm font-extrabold text-foreground tabular-nums select-none">
                                {item.cantidad}
                            </span>
                            <button
                                type="button"
                                onClick={() => onCambiarCantidad(idx, item.cantidad + 1)}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-card hover:bg-primary hover:text-primary-foreground active:scale-95 flex items-center justify-center shadow-xs transition-all text-foreground"
                                title="Aumentar cantidad"
                                aria-label="Aumentar cantidad"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Subtotal + eliminar */}
                        <div className="text-right shrink-0 min-w-[65px] flex flex-col items-end">
                            <p className="text-xs font-extrabold text-foreground tabular-nums tracking-tighter">
                                S/ {(item.precio * item.cantidad).toFixed(2)}
                            </p>
                            <button 
                                type="button"
                                onClick={() => onEliminar(idx)} 
                                className="text-muted-foreground hover:text-destructive transition-colors p-1.5 -mr-1 mt-0.5 opacity-70 hover:opacity-100"
                                title="Eliminar producto"
                                aria-label="Eliminar producto"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Resumen */}
            <div className="px-4 py-3.5 bg-muted/20 border-t border-border/40">
                <div className="flex justify-between text-xs uppercase font-extrabold tracking-wider text-muted-foreground mb-1">
                    <span>{items.reduce((s, i) => s + i.cantidad, 0)} ítem(s)</span>
                    <span>{items.length} tipo(s)</span>
                </div>
                <div className="flex justify-between font-extrabold text-foreground items-center">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">Subtotal Estimado</span>
                    <span className="text-lg tabular-nums tracking-tight font-extrabold text-primary">S/ {total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
});
CarritoMinimarket.displayName = 'CarritoMinimarket';
export default CarritoMinimarket;
