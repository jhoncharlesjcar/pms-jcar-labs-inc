import React, { useState, memo } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { supabase } from '@/config/supabase';
import { useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmDialog, { useConfirmDialog } from '@/components/common/ConfirmDialog';

/**
 * @param {Object} props
 * @param {string} props.hotelId
 */
export const ConfigZonaPeligrosa = memo(function ConfigZonaPeligrosa(/** @type {any} */ { hotelId }) {
    const qc = useQueryClient();
    const [deletePeriod, setDeletePeriod] = useState('dia');
    const [deleteType, setDeleteType] = useState('todos'); // 'todos' | 'hotel' | 'minimarket'
    const [deleteDate, setDeleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [deleteDateEnd, setDeleteDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isDeleting, setIsDeleting] = useState(false);
    const { confirmProps, requestConfirm } = useConfirmDialog();

    const handleDeleteData = async () => {
        if (!deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)) return;
        requestConfirm({
            title: '¿Eliminar datos permanentemente?',
            description: 'Se eliminarán las ventas y reservas del periodo seleccionado. Esta acción es irreversible.',
            variant: 'destructive',
            confirmText: 'Eliminar permanentemente',
            onConfirm: async () => {
                    setIsDeleting(true);
                    try {
                        const date = new Date(deleteDate + 'T00:00:00'); // Evitar problemas de timezone
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

                        // Borrar Hotel (Ventas y Reservas)
                        if (deleteType === 'todos' || deleteType === 'hotel') {
                            const { error: errVentas } = await supabase
                                .from('ventas')
                                .delete()
                                .eq('hotel_id', hotelId)
                                .gte('created_date', startISO)
                                .lte('created_date', endISO);

                            if (errVentas) throw errVentas;

                            const { error: errReservas } = await supabase
                                .from('reservas')
                                .delete()
                                .eq('hotel_id', hotelId)
                                .gte('created_date', startISO)
                                .lte('created_date', endISO);

                            if (errReservas) throw errReservas;
                        }

                        // Borrar Minimarket (Ventas POS)
                        if (deleteType === 'todos' || deleteType === 'minimarket') {
                            const { error: errVentasPOS } = await supabase
                                .from('ventas_pos')
                                .delete()
                                .eq('hotel_id', hotelId)
                                .gte('created_date', startISO)
                                .lte('created_date', endISO);

                            if (errVentasPOS) throw errVentasPOS;
                        }

                        toast.success('Datos eliminados correctamente.');
                        qc.invalidateQueries({ queryKey: ['ventas', hotelId] });
                        qc.invalidateQueries({ queryKey: ['reservas', hotelId] });
                        qc.invalidateQueries({ queryKey: ['ventas_pos', hotelId] });
                    } catch (error) {
                        logger.error('Error al borrar datos:', error);
                        toast.error('Hubo un error al borrar los datos.');
                    } finally {
                        setIsDeleting(false);
                    }
            }
        });
    };

    return (
        <div className="bg-red-500/5 dark:bg-red-500/[0.03] backdrop-blur-xl rounded-xl border border-red-500/20 p-5 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-4">
                <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center border border-red-500/20 shadow-xs">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                </div>
                <div>
                    <h2 className="font-extrabold text-red-500 text-lg tracking-tight flex items-center gap-2">
                        Mantenimiento de Datos
                    </h2>
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-400/80 mt-0.5">Precaución: Esta acción no se puede deshacer</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="delete_period" className="text-[9px] font-black text-red-500/70 uppercase tracking-widest ml-1">Periodo a eliminar</Label>
                    <select 
                        id="delete_period"
                        className="flex h-9 w-full rounded-md border border-red-500/20 bg-background/50 px-3 py-1.5 text-xs text-foreground font-bold focus:ring-red-500/30 shadow-inner cursor-pointer"
                        value={deletePeriod}
                        onChange={e => setDeletePeriod(e.target.value)}
                    >
                        <option value="dia">Por Día</option>
                        <option value="mes">Por Mes</option>
                        <option value="año">Por Año</option>
                        <option value="rango">Por Rango de Fechas</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="delete_type" className="text-[9px] font-black text-red-500/70 uppercase tracking-widest ml-1">¿Qué borrar?</Label>
                    <select 
                        id="delete_type"
                        className="flex h-9 w-full rounded-md border border-red-500/20 bg-background/50 px-3 py-1.5 text-xs text-foreground font-bold focus:ring-red-500/30 shadow-inner cursor-pointer"
                        value={deleteType}
                        onChange={e => setDeleteType(e.target.value)}
                    >
                        <option value="todos">Todo (Hotel + Minimarket)</option>
                        <option value="hotel">Solo Hotel (Reservas/Ventas)</option>
                        <option value="minimarket">Solo Minimarket (POS)</option>
                    </select>
                </div>
                
                <div className={cn("space-y-1.5", deletePeriod === 'rango' ? "col-span-1 sm:col-span-2 grid grid-cols-2 gap-4" : "")}>
                    <div className="space-y-1.5">
                        <Label htmlFor="delete_date" className="text-[9px] font-black text-red-500/70 uppercase tracking-widest ml-1">
                            {deletePeriod === 'rango' ? 'Desde' : 'Fecha de referencia'}
                        </Label>
                        <Input 
                            id="delete_date"
                            type="date" 
                            className="h-9 rounded-md border-red-500/20 bg-background/50 px-3 text-xs font-bold shadow-inner" 
                            value={deleteDate}
                            onChange={(e) => setDeleteDate(e.target.value)}
                        />
                    </div>
                    {deletePeriod === 'rango' && (
                        <div className="space-y-1.5 mt-0">
                            <Label htmlFor="delete_date_end" className="text-[9px] font-black text-red-500/70 uppercase tracking-widest ml-1">Hasta</Label>
                            <Input 
                                id="delete_date_end"
                                type="date" 
                                className="h-9 rounded-md border-red-500/20 bg-background/50 px-3 text-xs font-bold shadow-inner" 
                                value={deleteDateEnd}
                                onChange={(e) => setDeleteDateEnd(e.target.value)}
                                min={deleteDate} // Evita que la fecha fin sea menor a la de inicio
                            />
                        </div>
                    )}
                </div>
            </div>

            <Button 
                variant="destructive" 
                className="w-full h-9 rounded-md gap-2 font-extrabold text-[9px] uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                onClick={handleDeleteData}
                disabled={isDeleting || !deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)}
            >
                {isDeleting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <Trash2 className="w-4 h-4" />
                )}
                {isDeleting ? 'Borrando...' : 'Borrar Datos Permanentemente'}
            </Button>
            {/* @ts-ignore */}
            <ConfirmDialog {...confirmProps} isPending={isDeleting} />
        </div>
    );
});
ConfigZonaPeligrosa.displayName = 'ConfigZonaPeligrosa';
