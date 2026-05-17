import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Search, ExternalLink, Printer, TrendingUp, ShoppingCart, Hotel, CalendarDays, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TicketPDF from '@/components/TicketPDF';
import TicketPOSPDF from '@/components/pos/TicketPOSPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHotelData } from '@/hooks/use-hotel-data';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const estadoComp = {
    ticket_interno: { label: 'Ticket Interno', color: 'bg-secondary/20 text-muted-foreground border-border/50' },
    sunat_pendiente: { label: 'SUNAT Pendiente', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
    sunat_emitido: { label: 'SUNAT Emitido', color: 'bg-green-500/10 text-green-500 border-green-500/20' },
};

const metodoPagoIcon = { 
    efectivo: <EfectivoIcon />, 
    yape: <YapeIcon />, 
    plin: <PlinIcon />, 
    transferencia: '🏦', 
    tarjeta: <TarjetaIcon /> 
};

export default function Ventas() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [busqueda, setBusqueda] = useState('');
    const [filtroMetodo, setFiltroMetodo] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'hotel' | 'pos'
    const [ventaDetalle, setVentaDetalle] = useState(null);

    const { data: ventasHotel = [], isLoading: loadHotel } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => hotelDb.Venta.list(),
        enabled: !!hotelId,
    });

    const { data: ventasPOS = [], isLoading: loadPOS } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => hotelDb.VentaPOS.list('-created_date'),
        enabled: !!hotelId,
    });

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    const todasLasVentas = useMemo(() => {
        const h = ventasHotel.map(v => ({ ...v, _tipo: 'hotel' }));
        const p = ventasPOS.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta })); 
        return [...h, ...p].sort((a, b) => {
            const dateB = new Date(b.created_date || b.fecha_venta).getTime();
            const dateA = new Date(a.created_date || a.fecha_venta).getTime();
            return dateB - dateA;
        });
    }, [ventasHotel, ventasPOS]);

    const hoy = new Date().toLocaleDateString('sv-SE');
    
    const totalesHoy = useMemo(() => {
        const deHoy = todasLasVentas.filter(v => {
            const f = (v.fecha_pago || v.fecha_venta || '').split('T')[0];
            return f === hoy;
        });
        return {
            total: deHoy.reduce((s, v) => s + Number(v.total || 0), 0),
            pos: deHoy.filter(v => v._tipo === 'pos').reduce((s, v) => s + Number(v.total || 0), 0),
            hotel: deHoy.filter(v => v._tipo === 'hotel').reduce((s, v) => s + Number(v.total || 0), 0),
        };
    }, [todasLasVentas, hoy]);

    const filtradas = todasLasVentas.filter(v => {
        const nombre = v.huesped_nombre || 'Cliente mostrador';
        const matchBusq = !busqueda || nombre.toLowerCase().includes(busqueda.toLowerCase()) || v.numero_ticket?.includes(busqueda) || v.habitacion_numero?.includes(busqueda);
        const matchMetodo = filtroMetodo === 'todos' || v.metodo_pago === filtroMetodo;
        const matchTipo = filtroTipo === 'todos' || v._tipo === filtroTipo;
        return matchBusq && matchMetodo && matchTipo;
    });

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl sm:text-4xl font-black text-foreground tracking-tight">Ventas y Tickets</h1>
                    <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">Historial consolidado del sistema</p>
                </div>
                <div className="flex items-center gap-3 bg-card/40 backdrop-blur-xl px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl border border-border/50 shadow-sm w-full sm:w-auto">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-[9px] sm:text-[10px] text-primary font-black uppercase tracking-widest leading-none mb-1">Caja Hoy</p>
                        <p className="text-xl sm:text-2xl font-black text-foreground leading-tight">S/ {totalesHoy.total.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Resumen Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[
                    { label: 'Minimarket', val: totalesHoy.pos, icon: ShoppingCart, color: 'text-amber-500', bg: 'bg-amber-500/5 border-amber-500/10' },
                    { label: 'Hotel Hoy', val: totalesHoy.hotel, icon: Hotel, color: 'text-blue-500', bg: 'bg-blue-500/5 border-blue-500/10' },
                    { label: 'Histórico', val: todasLasVentas.reduce((s, v) => s + Number(v.total || 0), 0), icon: Wallet, color: 'text-green-500', bg: 'bg-green-500/5 border-green-500/10' },
                ].map((stat, i) => (
                    <motion.div 
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={cn("p-4 sm:p-6 rounded-[1.5rem] sm:rounded-3xl border backdrop-blur-xl shadow-sm", stat.bg)}
                    >
                        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                            <stat.icon className={cn("w-4 h-4 sm:w-5 sm:h-5", stat.color)} />
                            <p className="text-[9px] sm:text-xs font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                        </div>
                        <p className="text-xl sm:text-3xl font-black text-foreground tracking-tight">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </motion.div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input 
                        value={busqueda} 
                        onChange={e => setBusqueda(e.target.value)} 
                        placeholder="Ticket, cliente o habitación..." 
                        className="pl-11 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-card/50 backdrop-blur-sm border-border/50 shadow-inner text-sm" 
                    />
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger className="w-28 sm:w-36 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-card/50 backdrop-blur-sm border-border/50 text-xs sm:text-sm font-black"><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent className="rounded-2xl backdrop-blur-xl">
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="hotel">🏨 Hotel</SelectItem>
                            <SelectItem value="pos">🛒 POS</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1 bg-secondary/10 border border-border/30 p-1 rounded-xl sm:rounded-2xl overflow-x-auto scrollbar-hide">
                        {['todos', 'efectivo', 'yape', 'plin', 'tarjeta'].map(m => (
                            <button key={m} onClick={() => setFiltroMetodo(m)} className={cn(
                                "px-3 sm:px-4 py-2 rounded-lg sm:rounded-xl text-[10px] font-black uppercase transition-all",
                                filtroMetodo === m ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}>
                                {m === 'todos' ? 'Todos' : metodoPagoIcon[m] || m}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-card/40 backdrop-blur-2xl rounded-[2.5rem] border border-border/50 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/50 bg-secondary/10 text-left">
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Origen</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Ticket</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Cliente</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px] text-right">Total</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Pago</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Estado</th>
                                <th className="px-6 py-5 font-bold text-muted-foreground uppercase tracking-wider text-[10px] text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                            <AnimatePresence mode="popLayout">
                                {filtradas.map((v, idx) => {
                                    const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                                    return (
                                        <motion.tr 
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            key={`${v._tipo}-${v.id}`} 
                                            className="hover:bg-primary/5 transition-colors group"
                                        >
                                            <td className="px-6 py-4">
                                                {v._tipo === 'hotel' 
                                                    ? <div className="flex items-center gap-2 text-blue-500 font-bold"><Hotel className="w-4 h-4" /> Hotel</div>
                                                    : <div className="flex items-center gap-2 text-amber-500 font-bold"><ShoppingCart className="w-4 h-4" /> POS</div>
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-foreground">#{v.numero_ticket}</p>
                                                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {v.fecha_pago || v.fecha_venta}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-foreground truncate max-w-[150px]">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                                {v.habitacion_numero && <p className="text-[10px] text-primary font-bold">Habitación #{v.habitacion_numero}</p>}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-foreground text-base">
                                                S/ {Number(v.total || 0).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-xs font-medium capitalize">
                                                    <span className="scale-125">{metodoPagoIcon[v.metodo_pago]}</span>
                                                    {v.metodo_pago}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn("text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter border", comp.color)}>
                                                    {comp.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex justify-center gap-2">
                                                    <button onClick={() => setVentaDetalle(v)} className="p-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-sm" title="Imprimir Ticket">
                                                        <Printer className="w-4 h-4" />
                                                    </button>
                                                    {v.estado_comprobante === 'sunat_pendiente' && (
                                                        <button
                                                            onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                                            className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                                            title="Portal SUNAT"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                            {(loadHotel || loadPOS) && (
                                <tr>
                                    <td colSpan={7} className="py-24 text-center">
                                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
                                        <p className="text-sm font-bold text-muted-foreground mt-4 tracking-widest uppercase">Consultando base de datos...</p>
                                    </td>
                                </tr>
                            )}
                            {filtradas.length === 0 && !loadHotel && !loadPOS && (
                                <tr>
                                    <td colSpan={7} className="text-center py-32 text-muted-foreground">
                                        <div className="bg-secondary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-border/20">
                                            <Receipt className="w-10 h-10 opacity-20" />
                                        </div>
                                        <p className="text-lg font-bold">Sin resultados</p>
                                        <p className="text-sm opacity-60">Ajusta los filtros para encontrar lo que buscas</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
 
            {/* Mobile Cards View */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
                <AnimatePresence mode="popLayout">
                    {filtradas.map((v, idx) => {
                        const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                        return (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={`mob-${v._tipo}-${v.id}`}
                                className="glass-card p-4 rounded-2xl border border-border/50 flex flex-col gap-3"
                            >
                                <div className="flex items-center justify-between">
                                    <div className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border", v._tipo === 'hotel' ? "text-blue-500 border-blue-500/20 bg-blue-500/5" : "text-amber-500 border-amber-500/20 bg-amber-500/5")}>
                                        {v._tipo === 'hotel' ? 'Hotel' : 'Minimarket'}
                                    </div>
                                    <span className={cn("text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter border", comp.color)}>
                                        {comp.label}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-black text-sm text-foreground">#{v.numero_ticket}</p>
                                        <p className="text-xs font-bold text-muted-foreground truncate max-w-[180px]">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-primary tracking-tight">S/ {Number(v.total || 0).toFixed(2)}</p>
                                        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground font-medium">
                                            {metodoPagoIcon[v.metodo_pago]}
                                            <span className="capitalize">{v.metodo_pago}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border/10">
                                    <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                        <CalendarDays className="w-3 h-3" /> {format(new Date(v.created_date || v.fecha_venta), "dd MMM, HH:mm", { locale: es })}
                                    </p>
                                    <div className="flex gap-2">
                                        <button onClick={() => setVentaDetalle(v)} className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                            <Printer className="w-3.5 h-3.5" />
                                        </button>
                                        {v.estado_comprobante === 'sunat_pendiente' && (
                                            <button onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')} className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Modal ticket detalle con Glassmorphism */}
            <AnimatePresence>
                {ventaDetalle && (
                    <Dialog open onOpenChange={() => setVentaDetalle(null)}>
                        <DialogContent className="max-w-md bg-card/95 backdrop-blur-2xl border-border/50 shadow-2xl rounded-[2.5rem] p-8">
                            <DialogHeader>
                                <DialogTitle className="font-display text-2xl text-center">Detalle de Ticket</DialogTitle>
                                <p className="text-center text-muted-foreground text-xs uppercase tracking-[0.2em] font-bold">#{ventaDetalle.numero_ticket}</p>
                            </DialogHeader>
                            
                            <div className="mt-6 p-4 bg-background/50 rounded-3xl border border-border/30 shadow-inner">
                                {ventaDetalle._tipo === 'pos' ? (
                                    <TicketPOSPDF venta={ventaDetalle} config={config} />
                                ) : (
                                    <TicketPDF venta={ventaDetalle} config={config} />
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-3 mt-8">
                                {ventaDetalle.estado_comprobante === 'sunat_pendiente' && (
                                    <Button
                                        onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                        className="h-12 rounded-2xl gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Declarar en SUNAT
                                    </Button>
                                )}
                                <Button className="h-12 rounded-2xl shadow-lg shadow-primary/20" onClick={() => window.print()}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir Copia
                                </Button>
                                <Button variant="outline" className="h-12 rounded-2xl border-border/50" onClick={() => setVentaDetalle(null)}>Cerrar</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </motion.div>
    );
}