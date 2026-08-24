import React, { memo } from 'react';
import { Award } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isSimpleRoomType, calculateEarnedPoints } from '@/services/loyalty.service';

export const FidelidadCard = memo(function FidelidadCard(/** @type {any} */ {
    isLoyaltyEnabled, 
    loyaltyAccount, 
    canRedeem, 
    redimirPuntos, 
    setRedimirPuntos, 
    descuentoPuntos, 
    reserva 
}) {
    if (!isLoyaltyEnabled) return null;

    return (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-foreground">Fidelización por Puntos</p>
                        <p className="text-[10px] text-muted-foreground">Saldo actual: <strong className="text-amber-600 dark:text-amber-400">{loyaltyAccount?.points_balance || 0} Pts</strong></p>
                    </div>
                </div>
                {canRedeem && (
                    <div className="flex items-center gap-2">
                        <Label htmlFor="redimir-switch" className="text-xs font-bold text-amber-600 dark:text-amber-400 cursor-pointer">
                            Redimir 100 Pts
                        </Label>
                        <Switch
                            id="redimir-switch"
                            checked={redimirPuntos}
                            onCheckedChange={setRedimirPuntos}
                            className="data-[state=checked]:bg-amber-500"
                        />
                    </div>
                )}
            </div>
            {canRedeem && redimirPuntos && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold bg-amber-500/15 p-2 rounded-lg leading-tight">
                    ✨ Descuento de S/ {descuentoPuntos.toFixed(2)} aplicado (50% desc. en hab. simple). Se descontarán 100 Pts al cobrar.
                </p>
            )}
            {!canRedeem && (loyaltyAccount?.points_balance || 0) < 100 && (
                <p className="text-[10px] text-muted-foreground italic">
                    Se requieren mínimo 100 Pts para redimir descuento (esta estadía otorgará {calculateEarnedPoints(reserva.noches || 1)} Pts).
                </p>
            )}
            {!canRedeem && (loyaltyAccount?.points_balance || 0) >= 100 && !isSimpleRoomType(reserva.habitacion_tipo) && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                    El huésped posee 100+ Pts acumulados pero la recompensa solo aplica a habitaciones simples (Actual: {reserva.habitacion_tipo || 'Doble/Matrimonial'}).
                </p>
            )}
        </div>
    );
});
