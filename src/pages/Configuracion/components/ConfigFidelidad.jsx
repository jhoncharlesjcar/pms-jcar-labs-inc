import React from 'react';
import { Award, CheckCircle2, Gift, Clock, ShieldCheck } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export function ConfigFidelidad({ form, setForm }) {
    const isEnabled = form.loyalty_program_enabled === true;

    const toggleProgram = (checked) => {
        setForm({ ...form, loyalty_program_enabled: checked });
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 text-amber-500 shadow-xs">
                        <Award className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-foreground text-lg tracking-tight">Programa de Fidelización por Puntos</h2>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-0.5">Huéspedes frecuentes y recompensas</p>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <Label htmlFor="loyalty-switch" className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                        {isEnabled ? 'Activado' : 'Desactivado'}
                    </Label>
                    <Switch
                        id="loyalty-switch"
                        checked={isEnabled}
                        onCheckedChange={toggleProgram}
                        className="data-[state=checked]:bg-amber-500"
                    />
                </div>
            </div>

            {/* Reglas de negocio vigentes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="p-4 bg-card/60 border border-border/40 rounded-xl space-y-1.5 shadow-sm transition-all hover:border-amber-500/30">
                    <div className="flex items-center gap-2 text-amber-500 mb-3">
                        <Gift className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest text-foreground">Acumulación</span>
                    </div>
                    <p className="text-lg font-extrabold text-foreground tracking-tight">10 Puntos / Noche</p>
                    <p className="text-xs font-bold text-muted-foreground">Calculado al realizar check-out exitoso.</p>
                </div>

                <div className="p-4 bg-card/60 border border-border/40 rounded-xl space-y-1.5 shadow-sm transition-all hover:border-emerald-500/30">
                    <div className="flex items-center gap-2 text-emerald-500 mb-3">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest text-foreground">Canje Recompensa</span>
                    </div>
                    <p className="text-lg font-extrabold text-foreground tracking-tight">100 Pts = 50% Desc.</p>
                    <p className="text-xs font-bold text-muted-foreground">Aplica en tarifa de habitación simple.</p>
                </div>

                <div className="p-4 bg-card/60 border border-border/40 rounded-xl space-y-1.5 shadow-sm transition-all hover:border-blue-500/30">
                    <div className="flex items-center gap-2 text-blue-500 mb-3">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest text-foreground">Expiración</span>
                    </div>
                    <p className="text-lg font-extrabold text-foreground tracking-tight">12 Meses Inactivos</p>
                    <p className="text-xs font-bold text-muted-foreground">Reinicio a 0 si no se hospeda en 1 año.</p>
                </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-600 dark:text-amber-400 font-bold shadow-xs">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    <strong className="font-black uppercase tracking-widest block mb-1">Aislamiento por Hotel (Multi-Tenant):</strong> El saldo de puntos acumulado por cada huésped pertenece exclusivamente a tu establecimiento. La opción de redimir el 50% de descuento es una decisión manual del recepcionista durante el cobro.
                </p>
            </div>
        </div>
    );
}
