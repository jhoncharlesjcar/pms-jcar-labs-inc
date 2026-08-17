import React, { useState, useRef, useEffect, memo } from 'react';
import { Percent, Plus, Trash2 } from 'lucide-react';
import { gsap } from 'gsap';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';
import { supabase } from '@/config/supabase';
import { useHotelData } from '@/hooks/useHotelData';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export const ConfigTarifas = memo(function ConfigTarifas(/** @type {{ hotelId: string }} */ { hotelId }) {
    const qc = useQueryClient();
    const { db: hotelDb } = useHotelData();
    const [tarifaForm, setTarifaForm] = useState({
        nombre: '',
        tipo: 'temporada',
        fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
        fecha_fin: format(new Date(), 'yyyy-MM-dd'),
        habitacion_tipo: 'todos',
        factor_ajuste: 1.25,
        activo: true
    });
    const [showTarifaModal, setShowTarifaModal] = useState(false);

    const { data: tarifas = [] } = useQuery({
        queryKey: ['tarifas_dinamicas', hotelId],
        queryFn: () => hotelDb.TarifaDinamica.list(),
        enabled: !!hotelId,
        retry: false,
    });

    const tarifasListRef = useRef(null);
    const gsapAnimRef = useRef(null);

    // GSAP stagger en lista de tarifas (después de declarar tarifas)
    useEffect(() => {
        if (!tarifasListRef.current) return;
        const items = tarifasListRef.current.querySelectorAll(':scope > div');
        if (items.length === 0) return;

        if (gsapAnimRef.current) gsapAnimRef.current.kill();

        const tween = gsap.fromTo(
            items,
            { opacity: 0, x: -10 },
            {
                opacity: 1,
                x: 0,
                duration: 0.3,
                ease: 'power2.out',
                stagger: { each: 0.05, from: 'start' },
            }
        );

        gsapAnimRef.current = tween;
        return () => { if (gsapAnimRef.current) { gsapAnimRef.current.kill(); gsapAnimRef.current = null; } };
    }, [tarifas.length]);

    const crearTarifa = useMutation({
        mutationFn: async (/** @type {any} */ nueva) => {
            const { data, error } = await supabase
                .from('tarifas_dinamicas')
                .insert({
                    hotel_id: hotelId,
                    ...nueva
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tarifas_dinamicas', hotelId] });
            toast.success('Tarifa dinámica/feriado registrada con éxito');
            setShowTarifaModal(false);
            setTarifaForm({
                nombre: '',
                tipo: 'temporada',
                fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
                fecha_fin: format(new Date(), 'yyyy-MM-dd'),
                habitacion_tipo: 'todos',
                factor_ajuste: 1.25,
                activo: true
            });
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al registrar tarifa dinámica');
        }
    });

    const actualizarTarifa = useMutation({
        mutationFn: async (/** @type {any} */ { id, updates }) => {
            const { data, error } = await supabase
                .from('tarifas_dinamicas')
                .update(updates)
                .eq('id', id);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tarifas_dinamicas', hotelId] });
            toast.success('Tarifa dinámica actualizada');
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al actualizar tarifa');
        }
    });

    const eliminarTarifa = useMutation({
        mutationFn: async (id) => {
            const { error } = await supabase
                .from('tarifas_dinamicas')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['tarifas_dinamicas', hotelId] });
            toast.success('Tarifa dinámica/feriado eliminada');
        },
        onError: (err) => {
            logger.error(err);
            toast.error('Error al eliminar tarifa');
        }
    });

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-xs">
                        <Percent className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-foreground text-lg tracking-tight">Gestor de Tarifas y Feriados</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Configura incrementos por temporadas altas y fechas festivas</p>
                    </div>
                </div>
                <Button 
                    onClick={() => {
                        setTarifaForm({
                            nombre: '',
                            tipo: 'temporada',
                            fecha_inicio: format(new Date(), 'yyyy-MM-dd'),
                            fecha_fin: format(new Date(), 'yyyy-MM-dd'),
                            habitacion_tipo: 'todos',
                            factor_ajuste: 1.25,
                            activo: true
                        });
                        setShowTarifaModal(true);
                    }} 
                    className="gap-2 shadow-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-md h-9 text-[9px] font-extrabold uppercase tracking-widest px-4 active:scale-95 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Agregar Feriado / Tarifa
                </Button>
            </div>

            <div ref={tarifasListRef} className="grid gap-3">
                {tarifas.map(t => {
                    const porcentaje = Math.round((Number(t.factor_ajuste) - 1.0) * 100);
                    const esIncremento = Number(t.factor_ajuste) >= 1.0;
                    const factorTxt = esIncremento ? `+${porcentaje}%` : `-${Math.abs(porcentaje)}%`;
                    
                    return (
                        <div key={t.id} className={cn(
                            "bg-card/40 border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:bg-card/60 shadow-sm hover:border-emerald-500/30",
                            t.activo ? "border-border/40" : "border-dashed border-border/30 opacity-60"
                        )}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center border flex-shrink-0 shadow-xs",
                                    t.activo ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-muted/10 border-border/30 text-muted-foreground"
                                )}>
                                    <Percent className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-extrabold text-foreground text-sm truncate tracking-tight">{t.nombre}</p>
                                        <span className={cn(
                                            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm shadow-xs",
                                            t.activo ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" : "bg-muted text-muted-foreground border border-border/40"
                                        )}>
                                            {t.habitacion_tipo === 'todos' ? 'Todas las Habs' : t.habitacion_tipo}
                                        </span>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-1">
                                        📅 {t.fecha_inicio} al {t.fecha_fin}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 justify-end">
                                <div className="text-right">
                                    <span className={cn(
                                        "text-[10px] font-bold px-2.5 py-1 rounded-md border",
                                        esIncremento ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/20 shadow-inner" : "bg-amber-500/5 text-amber-500 border-amber-500/20 shadow-inner"
                                    )}>
                                        Multiplicador: {t.factor_ajuste} ({factorTxt})
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <Switch 
                                        checked={t.activo !== false}
                                        onCheckedChange={(checked) => actualizarTarifa.mutate({ id: t.id, updates: { activo: checked } })}
                                        className="data-[state=checked]:bg-emerald-500"
                                    />
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        onClick={() => {
                                            toast(`¿Está seguro de eliminar la regla tarifaria "${t.nombre}"?`, {
                                                action: {
                                                    label: 'Eliminar',
                                                    onClick: () => eliminarTarifa.mutate(t.id)
                                                },
                                                cancel: { label: 'Cancelar', onClick: () => {} }
                                            });
                                        }}
                                        className="h-9 w-9 text-red-500/70 hover:text-red-500 hover:bg-red-500/10 rounded-md active:scale-95 transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {tarifas.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-border/50 rounded-xl bg-background/20">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">No hay feriados ni tarifas dinámicas registradas</p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">Las tarifas se aplicarán automáticamente al cotizar reservas</p>
                    </div>
                )}
            </div>

            {/* Modal para Agregar Tarifa Dinámica / Feriado */}
            {showTarifaModal && (
                <Dialog open={showTarifaModal} onOpenChange={setShowTarifaModal}>
                    <DialogContent className="sm:max-w-md glass-panel border-border/80 rounded-xl p-5 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-3 text-emerald-500 font-extrabold text-lg tracking-tight">
                                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20 shadow-xs">
                                    <Percent className="w-4 h-4" /> 
                                </div>
                                Configurar Tarifa Especial
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="tarifa_nombre" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre del Feriado / Temporada *</Label>
                                <Input 
                                    id="tarifa_nombre"
                                    value={tarifaForm.nombre} 
                                    onChange={e => setTarifaForm(prev => ({ ...prev, nombre: e.target.value }))}
                                    placeholder="Ej: Fiestas Patrias, Semana Santa"
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-emerald-500/30 shadow-inner px-3 text-xs font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="tarifa_fecha_inicio" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Inicio *</Label>
                                    <Input 
                                        id="tarifa_fecha_inicio"
                                        type="date"
                                        value={tarifaForm.fecha_inicio} 
                                        onChange={e => setTarifaForm(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                                        className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-emerald-500/30 shadow-inner px-3 text-xs font-bold uppercase"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="tarifa_fecha_fin" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Fecha Fin *</Label>
                                    <Input 
                                        id="tarifa_fecha_fin"
                                        type="date"
                                        value={tarifaForm.fecha_fin} 
                                        onChange={e => setTarifaForm(prev => ({ ...prev, fecha_fin: e.target.value }))}
                                        className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-emerald-500/30 shadow-inner px-3 text-xs font-bold uppercase"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="tarifa_habitacion_tipo" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Aplica a Habitación *</Label>
                                    <select 
                                        id="tarifa_habitacion_tipo"
                                        value={tarifaForm.habitacion_tipo} 
                                        onChange={e => setTarifaForm(prev => ({ ...prev, habitacion_tipo: e.target.value }))}
                                        className="flex h-9 w-full rounded-md border border-border/40 bg-background/50 px-3 py-1.5 text-xs text-foreground font-bold focus:ring-emerald-500/30 shadow-inner cursor-pointer"
                                    >
                                        <option value="todos">🌟 Todos los Tipos</option>
                                        <option value="simple">🛏️ Simple</option>
                                        <option value="doble simple">🛏️🛏️ Doble Simple</option>
                                        <option value="matrimonial">💝 Matrimonial</option>
                                        <option value="doble matrimonial">💝💝 Doble Matrimonial</option>
                                        <option value="mixta">🌀 Mixta</option>
                                        <option value="queen">👑 Queen</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="tarifa_factor_ajuste" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Multiplicador Tarifario *</Label>
                                    <Input 
                                        id="tarifa_factor_ajuste"
                                        type="number"
                                        step="0.05"
                                        min="0.5"
                                        max="3"
                                        value={tarifaForm.factor_ajuste} 
                                        onChange={e => setTarifaForm(prev => ({ ...prev, factor_ajuste: Number(e.target.value) }))}
                                        placeholder="Ej: 1.30 (+30%)"
                                        className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-emerald-500/30 shadow-inner px-3 text-xs font-bold text-emerald-500"
                                    />
                                </div>
                            </div>

                            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-md p-3 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                💡 <strong className="font-black uppercase tracking-widest">Ejemplo:</strong> Si el precio base es S/ 100 y el multiplicador es <strong className="font-black">1.30</strong>, la habitación costará <strong className="font-black">S/ 130</strong> durante el rango de fechas seleccionado.
                            </div>
                        </div>
                        <div className="flex gap-3 justify-end pt-4 border-t border-border/40">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowTarifaModal(false)}
                                className="rounded-md font-bold h-9 px-4 text-[9px] uppercase tracking-widest active:scale-95 transition-all border-border/40"
                            >
                                Cancelar
                            </Button>
                            <Button 
                                onClick={() => crearTarifa.mutate(tarifaForm)}
                                disabled={!tarifaForm.nombre || !tarifaForm.fecha_inicio || !tarifaForm.fecha_fin || crearTarifa.isPending}
                                className="rounded-md font-extrabold text-[9px] uppercase tracking-widest h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 transition-all shadow-sm"
                            >
                                {crearTarifa.isPending ? 'Guardando...' : 'Guardar Regla'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
});
ConfigTarifas.displayName = 'ConfigTarifas';
