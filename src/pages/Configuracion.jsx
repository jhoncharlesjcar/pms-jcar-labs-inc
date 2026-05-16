import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ExternalLink, CheckCircle, Trash2, Building2, Clock, MessageSquare, Shield, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/use-hotel-data';
import { supabase } from '@/lib/supabaseClient';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { motion } from 'framer-motion';

export default function Configuracion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        nombre: '', ruc: '', direccion: '', telefono: '', email: '',
        ciudad: '', modo_sunat: 'manual', mensaje_ticket: '¡Gracias por su preferencia!',
        hora_checkin: '14:00', hora_checkout: '12:00',
    });
    const [configId, setConfigId] = useState(null);
    const [deletePeriod, setDeletePeriod] = useState('dia');
    const [deleteType, setDeleteType] = useState('todos'); // 'todos' | 'hotel' | 'minimarket'
    const [deleteDate, setDeleteDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [deleteDateEnd, setDeleteDateEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isDeleting, setIsDeleting] = useState(false);

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });

    useEffect(() => {
        if (configs.length > 0) {
            const c = configs[0];
            setConfigId(c.id);
            setForm({
                nombre: c.nombre || '',
                ruc: c.ruc || '',
                direccion: c.direccion || '',
                telefono: c.telefono || '',
                email: c.email || '',
                ciudad: c.ciudad || '',
                modo_sunat: c.modo_sunat || 'manual',
                mensaje_ticket: c.mensaje_ticket || '¡Gracias por su preferencia!',
                hora_checkin: c.hora_checkin || '14:00',
                hora_checkout: c.hora_checkout || '12:00',
            });
        }
    }, [configs]);

    const guardar = useMutation({
        mutationFn: () => configId
            ? hotelDb.ConfigHotel.update(configId, form)
            : hotelDb.ConfigHotel.create(form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['config'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const modoSunatInfo = {
        manual: { label: 'Manual (Recomendado para hospedajes pequeños)', desc: 'El recepcionista decide cuándo ir a SUNAT. Perfecto para operar con tickets internos.' },
        automatico: { label: 'Automático (Empresas formales)', desc: 'Recordatorio automático para emitir comprobante en cada venta.' },
        desactivado: { label: 'Desactivado', desc: 'Sin módulo SUNAT. Solo tickets internos.' },
    };

    const handleDeleteData = async () => {
        if (!deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)) return;
        if (!confirm(`¿Estás seguro de que quieres eliminar TODAS las ventas y reservas del periodo seleccionado? Esta acción es irreversible.`)) return;

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

            alert('Datos eliminados correctamente.');
            qc.invalidateQueries({ queryKey: ['ventas'] });
            qc.invalidateQueries({ queryKey: ['reservas'] });
            qc.invalidateQueries({ queryKey: ['ventas_pos'] });
        } catch (error) {
            console.error('Error al borrar datos:', error);
            alert('Hubo un error al borrar los datos.');
        } finally {
            setIsDeleting(false);
        }
    };

    const sectionAnim = (i) => ({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
    });

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-2xl pb-10">
            {/* Header */}
            <motion.div {...sectionAnim(0)}>
                <h1 className="font-display text-3xl font-bold text-foreground">Configuración</h1>
                <p className="text-muted-foreground mt-1 text-lg">Datos del hospedaje y preferencias del sistema</p>
            </motion.div>

            {/* Datos del hotel */}
            <motion.div {...sectionAnim(1)} className="bg-card/60 backdrop-blur-xl rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                        <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Datos del Hospedaje</h2>
                        <p className="text-xs text-muted-foreground">Información fiscal y de contacto</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="sm:col-span-2 space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre del hospedaje *</Label>
                        <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Hospedaje Los Andes" className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">RUC (opcional)</Label>
                        <Input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} placeholder="20XXXXXXXXX" className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Ciudad</Label>
                        <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Cusco, Lima..." className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="sm:col-span-2 space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Dirección</Label>
                        <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Jr. Principal 123" className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono / WhatsApp</Label>
                        <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 888 777" className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hospedaje@email.com" className="bg-background/50 h-12 rounded-xl" />
                    </div>
                </div>
            </motion.div>

            {/* Horarios */}
            <motion.div {...sectionAnim(2)} className="bg-card/60 backdrop-blur-xl rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                        <Clock className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Horarios</h2>
                        <p className="text-xs text-muted-foreground">Hora estándar de entrada y salida</p>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hora de Check-in</Label>
                        <Input type="time" value={form.hora_checkin} onChange={e => setForm({ ...form, hora_checkin: e.target.value })} className="bg-background/50 h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Hora de Check-out</Label>
                        <Input type="time" value={form.hora_checkout} onChange={e => setForm({ ...form, hora_checkout: e.target.value })} className="bg-background/50 h-12 rounded-xl" />
                    </div>
                </div>
            </motion.div>

            {/* Ticket */}
            <motion.div {...sectionAnim(3)} className="bg-card/60 backdrop-blur-xl rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center border border-amber-500/20">
                        <MessageSquare className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Mensaje en el Ticket</h2>
                        <p className="text-xs text-muted-foreground">Se imprime al final de cada comprobante</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Mensaje de agradecimiento</Label>
                    <Input value={form.mensaje_ticket} onChange={e => setForm({ ...form, mensaje_ticket: e.target.value })} placeholder="¡Gracias por su preferencia!" className="bg-background/50 h-12 rounded-xl" />
                </div>
            </motion.div>

            {/* Módulo SUNAT */}
            <motion.div {...sectionAnim(4)} className="bg-card/60 backdrop-blur-xl rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                            <Shield className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="font-bold text-foreground text-lg">Módulo SUNAT</h2>
                            <p className="text-xs text-muted-foreground">Comprobantes electrónicos</p>
                        </div>
                    </div>
                    <button
                        onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                        className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-bold"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Ir al portal SUNAT
                    </button>
                </div>

                <div className="space-y-3">
                    {Object.entries(modoSunatInfo).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => setForm({ ...form, modo_sunat: key })}
                            className={cn(
                                "w-full text-left p-5 rounded-2xl border-2 transition-all",
                                form.modo_sunat === key
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-border/50 bg-background/30 hover:border-primary/40 hover:bg-background/50"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                    form.modo_sunat === key ? "border-primary" : "border-muted-foreground/40"
                                )}>
                                    {form.modo_sunat === key && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                                </div>
                                <p className="font-bold text-foreground text-sm">{info.label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 ml-8">{info.desc}</p>
                        </button>
                    ))}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-xs text-blue-500 dark:text-blue-400 leading-relaxed">
                    <strong>Nota SUNAT Perú:</strong> El sistema guarda el historial completo de ventas para cumplir con la normativa. Cuando un cliente solicite comprobante, puedes emitirlo directamente en el portal web de SUNAT usando tu Clave SOL.
                </div>
            </motion.div>

            {/* Mantenimiento de Datos */}
            <motion.div {...sectionAnim(5)} className="bg-red-500/5 dark:bg-red-500/[0.03] backdrop-blur-xl rounded-[2rem] border border-red-500/20 p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
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
                        <Label className="text-[10px] font-black text-red-500/70 uppercase tracking-widest ml-1">Periodo a eliminar</Label>
                        <select 
                            className="flex h-12 w-full rounded-xl border border-red-500/20 bg-background/50 px-4 py-2 text-sm text-foreground focus:ring-red-500/20"
                            value={deletePeriod}
                            onChange={e => setDeletePeriod(e.target.value)}
                        >
                            <option value="dia">Por Día</option>
                            <option value="mes">Por Mes</option>
                            <option value="año">Por Año</option>
                            <option value="rango">Por Rango de Fechas</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black text-red-500/70 uppercase tracking-widest ml-1">¿Qué borrar?</Label>
                        <select 
                            className="flex h-12 w-full rounded-xl border border-red-500/20 bg-background/50 px-4 py-2 text-sm text-foreground focus:ring-red-500/20"
                            value={deleteType}
                            onChange={e => setDeleteType(e.target.value)}
                        >
                            <option value="todos">Todo (Hotel + Minimarket)</option>
                            <option value="hotel">Solo Hotel (Reservas/Ventas)</option>
                            <option value="minimarket">Solo Minimarket (POS)</option>
                        </select>
                    </div>
                    
                    <div className={cn("space-y-2", deletePeriod === 'rango' ? "col-span-1 sm:col-span-2 grid grid-cols-2 gap-3" : "")}>
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-red-500/70 uppercase tracking-widest ml-1">
                                {deletePeriod === 'rango' ? 'Desde' : 'Fecha de referencia'}
                            </Label>
                            <Input 
                                type="date" 
                                className="h-12 rounded-xl border-red-500/20 bg-background/50 text-xs sm:text-sm" 
                                value={deleteDate}
                                onChange={e => setDeleteDate(e.target.value)}
                            />
                        </div>
                        {deletePeriod === 'rango' && (
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black text-red-500/70 uppercase tracking-widest ml-1">Hasta</Label>
                                <Input 
                                    type="date" 
                                    className="h-12 rounded-xl border-red-500/20 bg-background/50 text-xs sm:text-sm" 
                                    value={deleteDateEnd}
                                    onChange={e => setDeleteDateEnd(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="sm:col-span-2 pt-2">
                        <Button 
                            variant="destructive" 
                            onClick={handleDeleteData} 
                            disabled={isDeleting || !deleteDate || (deletePeriod === 'rango' && !deleteDateEnd)}
                            className="w-full h-14 rounded-xl gap-2 shadow-lg shadow-red-500/20 font-black text-xs uppercase tracking-widest"
                        >
                            <Trash2 className="w-4 h-4" />
                            {isDeleting ? 'Borrando...' : 'Confirmar Eliminación'}
                        </Button>
                    </div>
                </div>
            </motion.div>

            {/* Guardar */}
            <motion.div {...sectionAnim(6)} className="flex items-center gap-4">
                <Button 
                    onClick={() => guardar.mutate()} 
                    disabled={guardar.isPending || !form.nombre} 
                    className="gap-2 px-8 h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/20"
                >
                    {saved ? <><CheckCircle className="w-5 h-5" /> Guardado</> : <><Save className="w-5 h-5" /> {guardar.isPending ? 'Guardando...' : 'Guardar Configuración'}</>}
                </Button>
                {saved && <span className="text-sm text-green-500 font-bold">¡Configuración guardada!</span>}
            </motion.div>
        </motion.div>
    );
}