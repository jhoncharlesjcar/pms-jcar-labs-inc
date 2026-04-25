import { Trash2, Plus, Minus, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function CarritoPOS({ items, onCambiarCantidad, onEliminar, subtotalEstadia, reservaSeleccionada }) {
    const subtotalExtras = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
    const total = subtotalEstadia + subtotalExtras;

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-foreground">Carrito</h2>
                {items.length > 0 && (
                    <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                        {items.reduce((s, i) => s + i.cantidad, 0)} items
                    </span>
                )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                {/* Estadía */}
                {reservaSeleccionada && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-medium text-primary">🏨 Estadía</p>
                                <p className="text-sm font-semibold text-foreground">{reservaSeleccionada.huesped_nombre}</p>
                                <p className="text-xs text-muted-foreground">Hab. {reservaSeleccionada.habitacion_numero} · {reservaSeleccionada.noches} noche(s)</p>
                            </div>
                            <p className="font-bold text-foreground text-sm">S/ {subtotalEstadia.toFixed(2)}</p>
                        </div>
                    </div>
                )}

                {/* Extras */}
                {items.map((item, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground leading-tight truncate">
                                    {item.emoji || '📦'} {item.nombre}
                                </p>
                                <p className="text-xs text-muted-foreground">S/ {Number(item.precio).toFixed(2)} c/u</p>
                            </div>
                            <p className="font-bold text-sm text-foreground flex-shrink-0">
                                S/ {(item.precio * item.cantidad).toFixed(2)}
                            </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                                <button onClick={() => onCambiarCantidad(idx, item.cantidad - 1)}
                                    className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                                    <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-semibold w-6 text-center">{item.cantidad}</span>
                                <button onClick={() => onCambiarCantidad(idx, item.cantidad + 1)}
                                    className="w-6 h-6 rounded-lg bg-secondary flex items-center justify-center hover:bg-border transition-colors">
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                            <button onClick={() => onEliminar(idx)} className="text-red-400 hover:text-red-600 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                ))}

                {items.length === 0 && !reservaSeleccionada && (
                    <div className="text-center py-8">
                        <ShoppingCart className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">Agrega productos o selecciona una reserva</p>
                    </div>
                )}
            </div>

            {/* Totales */}
            {(items.length > 0 || reservaSeleccionada) && (
                <div className="border-t border-border pt-3 mt-3 space-y-1">
                    {reservaSeleccionada && subtotalEstadia > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Estadía</span><span>S/ {subtotalEstadia.toFixed(2)}</span>
                        </div>
                    )}
                    {subtotalExtras > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Extras</span><span>S/ {subtotalExtras.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-foreground text-base pt-1 border-t border-border">
                        <span>Total</span><span>S/ {total.toFixed(2)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}