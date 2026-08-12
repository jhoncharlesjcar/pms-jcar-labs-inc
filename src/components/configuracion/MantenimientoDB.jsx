import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { supabase } from '@/lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';

export function MantenimientoDB({ hotelId }) {
    const qc = useQueryClient();
    const [deletePeriod, setDeletePeriod] = useState('dia');
    const [deleteType, setDeleteType] = useState('todos'); // 'todos' | 'hotel' | 'minimarket'
    const [deleteDate, setDeleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [deleteDateEnd, setDeleteDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isDeleting, setIsDeleting] = useState(false);

    const executeDelete = async () => {
        setIsDeleting(true);
        try {
            const date = new Date(deleteDate + 'T00:00:00');
            let start, end;

            if (deletePeriod === 'dia') {
                start = startOfDay(date);
                end = endOfDay(date);
            } else if (deletePeriod === 'mes') {
                start = startOfMonth(date);
                end = endOfMonth(date);
            } else if (deletePeriod === 'año') {
                start = startOfYear(date);
                end = endOfYear(date);
            } else if (deletePeriod === 'rango') {
                start = startOfDay(new Date(deleteDate + 'T00:00:00'));
                end = endOfDay(new Date(deleteDateEnd + 'T00:00:00'));
            }

            const startISO = start.toISOString();
            const endISO = end.toISOString();

            if (deleteType === 'todos' || deleteType === 'hotel') {
                await supabase.from('ventas').delete().eq('hotel_id', hotelId).gte('created_date', startISO).lte('created_date', endISO);
                await supabase.from('reservas').delete().eq('hotel_id', hotelId).gte('created_date', startISO).lte('created_date', endISO);
            }

            if (deleteType === 'todos' || deleteType === 'minimarket') {
                await supabase.from('ventas_pos').delete().eq('hotel_id', hotelId).gte('created_date', startISO).lte('created_date', endISO);
            }

            toast.success('Datos eliminados correctamente.');
            qc.invalidateQueries({ queryKey: ['ventas'] });
            qc.invalidateQueries({ queryKey: ['reservas'] });
            qc.invalidateQueries({ queryKey: ['ventas_pos'] });
        } catch (error) {
            logger.error('Error al borrar datos:', error);
            toast.error('Hubo un error al borrar los datos.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteData = async () => {
        if (!deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)) return;
        toast('¿Estás seguro de que quieres eliminar TODAS las ventas y reservas del periodo seleccionado? Esta acción es irreversible.', {
            action: { label: 'Eliminar', onClick: executeDelete },
            cancel: { label: 'Cancelar', onClick: () => {} }
        });
    };

    return (
        <div className="glass-panel rounded-[2rem] border border-red-500/20 p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-foreground/5 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]">
                    <AlertTriangle className="w-5 h-5 text-red-500 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                </div>
                <div>
                    <h2 className="font-bold text-red-500 text-lg flex items-center gap-2">
                        Mantenimiento de Datos
                    </h2>
                    <p className="text-xs text-red-400/80">Precaución: Esta acción no se puede deshacer</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="text-xs font-black text-red-500 uppercase tracking-widest ml-1">Periodo a eliminar</Label>
                    <select 
                        className="flex h-12 w-full rounded-xl border border-red-500/20 glass-panel text-foreground px-4 py-2 text-sm focus:ring-red-500/20 outline-none"
                        value={deletePeriod}
                        onChange={e => setDeletePeriod(e.target.value)}
                    >
                        <option value="dia" className="bg-zinc-900 text-foreground">Por Día</option>
                        <option value="mes" className="bg-zinc-900 text-foreground">Por Mes</option>
                        <option value="año" className="bg-zinc-900 text-foreground">Por Año</option>
                        <option value="rango" className="bg-zinc-900 text-foreground">Por Rango de Fechas</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-red-500 uppercase tracking-widest ml-1">¿Qué borrar?</Label>
                    <select 
                        className="flex h-12 w-full rounded-xl border border-red-500/20 glass-panel text-foreground px-4 py-2 text-sm focus:ring-red-500/20 outline-none"
                        value={deleteType}
                        onChange={e => setDeleteType(e.target.value)}
                    >
                        <option value="todos" className="bg-zinc-900 text-foreground">Todo (Hotel + Minimarket)</option>
                        <option value="hotel" className="bg-zinc-900 text-foreground">Solo Hotel (Reservas/Ventas)</option>
                        <option value="minimarket" className="bg-zinc-900 text-foreground">Solo Minimarket (POS)</option>
                    </select>
                </div>
                
                <div className={cn("space-y-2", deletePeriod === 'rango' ? "col-span-1 sm:col-span-2 grid grid-cols-2 gap-3" : "")}>
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-red-500 uppercase tracking-widest ml-1">
                            {deletePeriod === 'rango' ? 'Desde' : 'Fecha de referencia'}
                        </Label>
                        <Input type="date" className="h-12 rounded-xl border-red-500/20 glass-panel text-foreground text-base sm:text-sm" value={deleteDate} onChange={e => setDeleteDate(e.target.value)} />
                    </div>
                    {deletePeriod === 'rango' && (
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-red-500 uppercase tracking-widest ml-1">Hasta</Label>
                            <Input type="date" className="h-12 rounded-xl border-red-500/20 glass-panel text-foreground text-base sm:text-sm" value={deleteDateEnd} onChange={e => setDeleteDateEnd(e.target.value)} />
                        </div>
                    )}
                </div>

                <div className="sm:col-span-2 pt-2">
                    <Button 
                        variant="destructive" 
                        onClick={handleDeleteData} 
                        disabled={isDeleting || !deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)}
                        className="w-full h-14 rounded-xl gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/30 shadow-lg font-black text-xs uppercase tracking-widest transition"
                    >
                        <Trash2 className="w-4 h-4" />
                        {isDeleting ? 'Borrando...' : 'Confirmar Eliminación'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
