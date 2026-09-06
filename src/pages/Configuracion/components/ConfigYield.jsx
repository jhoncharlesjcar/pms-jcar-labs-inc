import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, Trash2, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/config/supabase';
import logger from '@/lib/logger';
import { useHotelData } from '@/hooks/useHotelData';

export function ConfigYield() {
    const { hotelId } = useHotelData();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchYieldRules() {
            if (!hotelId) return;
            const { data, error } = await supabase
                .from('tarifas_dinamicas')
                .select('*')
                .eq('hotel_id', hotelId)
                .eq('tipo', 'ocupacion')
                .order('umbral_ocupacion_min', { ascending: true });
                
            if (!error && data) {
                setRules(data);
            }
        }
        fetchYieldRules();
    }, [hotelId]);

    const addRule = () => {
        setRules([...rules, {
            id: 'temp-' + Date.now(),
            hotel_id: hotelId,
            nombre: 'Regla Yield Ocupación',
            tipo: 'ocupacion',
            umbral_ocupacion_min: 80,
            factor_ajuste: 1.10,
            activo: true,
            isNew: true
        }]);
    };

    const updateRule = (index, field, value) => {
        const newRules = [...rules];
        newRules[index][field] = value;
        setRules(newRules);
    };

    const saveRule = async (index) => {
        const rule = rules[index];
        setLoading(true);
        try {
            const ruleData = { ...rule };
            if (rule.isNew) {
                delete ruleData.id;
                delete ruleData.isNew;
            }

            const { data, error } = await supabase.from('tarifas_dinamicas').upsert(ruleData).select();
            if (error) throw error;
            
            toast.success('Regla de Yield guardada exitosamente');
            
            if (data && data[0]) {
                const newRules = [...rules];
                newRules[index] = data[0];
                setRules(newRules);
            }
        } catch (err) {
            toast.error('Error guardando la regla');
            logger.error('Error guardando regla de yield', err);
        } finally {
            setLoading(false);
        }
    };

    const deleteRule = async (index) => {
        const rule = rules[index];
        if (!rule.isNew) {
            try {
                await supabase.from('tarifas_dinamicas').delete().eq('id', rule.id);
                toast.success('Regla eliminada');
            } catch {
                toast.error('Error eliminando');
                return;
            }
        }
        const newRules = [...rules];
        newRules.splice(index, 1);
        setRules(newRules);
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 shadow-xs">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Yield Management</h2>
                        <p className="text-[10px] font-bold text-muted-foreground">Reglas de precios dinámicos por ocupación</p>
                    </div>
                </div>
                <Button onClick={addRule} size="sm" className="h-8 gap-1 bg-purple-600 hover:bg-purple-700 text-xs">
                    <Plus className="w-4 h-4" /> Nueva Regla
                </Button>
            </div>

            <div className="space-y-4">
                {rules.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-border/60 rounded-xl bg-background/30 text-muted-foreground text-sm">
                        No hay reglas de Yield configuradas. <br/>Añade una regla para subir el precio automáticamente cuando el hotel se llene.
                    </div>
                ) : (
                    rules.map((rule, i) => (
                        <div key={rule.id} className="p-4 rounded-xl border border-border/50 bg-background/50 flex flex-wrap items-end gap-4 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                            <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Si la ocupación supera el</Label>
                                <div className="relative">
                                    <Input 
                                        type="number"
                                        value={rule.umbral_ocupacion_min} 
                                        onChange={e => updateRule(i, 'umbral_ocupacion_min', parseInt(e.target.value))}
                                        className="h-9 pr-8 font-mono text-sm"
                                    />
                                    <span className="absolute right-3 top-2 text-xs text-muted-foreground font-bold">%</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-[120px]">
                                <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Multiplicar tarifa por</Label>
                                <div className="relative">
                                    <Input 
                                        type="number"
                                        step="0.01"
                                        value={rule.factor_ajuste} 
                                        onChange={e => updateRule(i, 'factor_ajuste', parseFloat(e.target.value))}
                                        className="h-9 font-mono text-sm text-purple-600 font-bold"
                                    />
                                </div>
                                <p className="text-[9px] text-muted-foreground ml-1">Ej: 1.15 = +15%</p>
                            </div>

                            <div className="space-y-1.5 flex items-center gap-2 pb-1">
                                <Label className="text-xs font-bold text-muted-foreground">Activo</Label>
                                <Switch 
                                    checked={rule.activo}
                                    onCheckedChange={v => updateRule(i, 'activo', v)}
                                    className="data-[state=checked]:bg-purple-500"
                                />
                            </div>

                            <div className="flex items-center gap-2 pb-1">
                                <Button onClick={() => saveRule(i)} disabled={loading} size="icon" variant="outline" className="w-9 h-9 border-purple-200 text-purple-600 hover:bg-purple-50">
                                    <Save className="w-4 h-4" />
                                </Button>
                                <Button onClick={() => deleteRule(i)} size="icon" variant="destructive" className="w-9 h-9 opacity-80 hover:opacity-100">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 mt-6">
                <p className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                    💡 <strong>Nota:</strong> Estas reglas se aplican multiplicándose. Si la ocupación está al 85% y la regla indica factor 1.10, una tarifa base de S/ 100 pasará automáticamente a S/ 110 para nuevas reservas y se sincronizará con Booking/Despegar.
                </p>
            </div>
        </div>
    );
}
