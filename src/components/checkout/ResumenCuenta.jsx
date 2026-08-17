import React, { memo } from 'react';
import { ReceiptText } from 'lucide-react';

export const ResumenCuenta = memo(function ResumenCuenta({ reserva, totalConsumos, totalCalc, igvCalc }) {
    return (
        <section aria-labelledby="checkout-resumen" className="space-y-3">
            <div className="flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-primary" />
                <h3 id="checkout-resumen" className="text-sm font-semibold text-foreground">Resumen de la cuenta</h3>
            </div>
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm">
                <div className="flex items-start justify-between gap-4 border-b border-border/50 pb-3">
                    <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{reserva.huesped_nombre}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">Habitación #{reserva.habitacion_numero} · {reserva.habitacion_tipo}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-background px-2.5 py-1 text-xs font-semibold">
                        {reserva.noches} {reserva.noches === 1 ? 'noche' : 'noches'}
                    </span>
                </div>
                <div className="space-y-2 pt-3">
                    <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Estadía · S/ {Number(reserva.precio_noche || 0).toFixed(2)} × {reserva.noches}</span>
                        <span className="font-semibold tabular-nums">S/ {totalCalc.total_estadia.toFixed(2)}</span>
                    </div>
                    {totalConsumos > 0 && (
                        <div className="flex justify-between gap-4">
                            <span className="text-muted-foreground">Consumos adicionales</span>
                            <span className="font-semibold tabular-nums">S/ {totalConsumos.toFixed(2)}</span>
                        </div>
                    )}
                    {totalCalc.descuento > 0 && (
                        <div className="flex justify-between gap-4 text-rose-600 dark:text-rose-400">
                            <span>Descuento aplicado</span>
                            <span className="font-semibold tabular-nums">-S/ {totalCalc.descuento.toFixed(2)}</span>
                        </div>
                    )}
                    {igvCalc.igv > 0 && (
                        <>
                            <div className="flex justify-between gap-4 border-t border-border/40 pt-2 text-xs">
                                <span className="text-muted-foreground">Base imponible</span>
                                <span className="font-semibold tabular-nums">S/ {igvCalc.base_imponible.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between gap-4 text-xs">
                                <span className="text-muted-foreground">IGV (18%)</span>
                                <span className="font-semibold tabular-nums">S/ {igvCalc.igv.toFixed(2)}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
});
