import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMOJI_DEFAULT = {
    bebidas: '🥤', snacks: '🍿', lacteos: '🥛', higiene: '🧴',
    licores: '🍺', cigarros: '🚬', otros: '📦',
};

export default function CarritoMinimarket({ items, onCambiarCantidad, onEliminar }) {
    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Carrito vacío</p>
                <p className="text-xs mt-1">Toca un producto para agregarlo</p>
            </div>
        );
    }

    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);

    return (
        <div className="divide-y divide-border">
            {items.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Emoji */}
                    <span className="text-2xl flex-shrink-0">
                        {item.emoji || EMOJI_DEFAULT[item.categoria] || '📦'}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight truncate">{item.nombre}</p>
                        <p className="text-xs text-muted-foreground">S/ {item.precio.toFixed(2)} c/u</p>
                    </div>

                    {/* Controles cantidad */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={() => onCambiarCantidad(idx, item.cantidad - 1)}
                            className="w-8 h-8 rounded-lg bg-secondary hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all active:scale-90"
                        >
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-sm font-bold text-foreground">{item.cantidad}</span>
                        <button
                            onClick={() => onCambiarCantidad(idx, item.cantidad + 1)}
                            className="w-8 h-8 rounded-lg bg-secondary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all active:scale-90"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Subtotal + eliminar */}
                    <div className="text-right flex-shrink-0 min-w-[60px]">
                        <p className="text-sm font-bold text-foreground">S/ {(item.precio * item.cantidad).toFixed(2)}</p>
                        <button onClick={() => onEliminar(idx)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            ))}

            {/* Resumen */}
            <div className="px-4 py-3 bg-secondary/30">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>{items.reduce((s, i) => s + i.cantidad, 0)} producto(s)</span>
                    <span>{items.length} tipo(s)</span>
                </div>
                <div className="flex justify-between font-bold text-foreground">
                    <span>Subtotal</span>
                    <span>S/ {total.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}