import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Receipt, Search, ExternalLink, Printer, TrendingUp, Filter, ShoppingCart, Hotel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TicketPDF from '@/components/TicketPDF';
import TicketPOSPDF from '@/components/pos/TicketPOSPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHotel } from '@/lib/HotelContext';

const estadoComp = {
    ticket_interno: { label: 'Ticket Interno', color: 'bg-secondary text-muted-foreground' },
    sunat_pendiente: { label: 'SUNAT Pendiente', color: 'bg-orange-100 text-orange-700' },
    sunat_emitido: { label: 'SUNAT Emitido', color: 'bg-green-100 text-green-700' },
};

const metodoPagoIcon = { efectivo: '💵', yape: '📱', plin: '📲', transferencia: '🏦', tarjeta: '💳' };

export default function Ventas() {
    const qc = useQueryClient();
    const { hotelActual } = useHotel();
    const hotelId = hotelActual?.id;
    const [busqueda, setBusqueda] = useState('');
    const [filtroMetodo, setFiltroMetodo] = useState('todos');
    const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'hotel' | 'pos'
    const [ventaDetalle, setVentaDetalle] = useState(null);

    // Cargar ventas de hotel
    const { data: ventasHotel = [], isLoading: loadHotel } = useQuery({
        queryKey: ['ventas', hotelId],
        queryFn: () => db.entities.Venta.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });

    // Cargar ventas de POS
    const { data: ventasPOS = [], isLoading: loadPOS } = useQuery({
        queryKey: ['ventaspos', hotelId],
        queryFn: () => db.entities.VentaPOS.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => db.entities.ConfigHotel.filter({ hotel_id: hotelId }),
        enabled: !!hotelId,
    });
    const config = configs[0] || {};

    const marcarSunatEmitido = useMutation({
        mutationFn: ({ id, tipo }) => tipo === 'pos' 
            ? db.entities.VentaPOS.update(id, { estado_comprobante: 'sunat_emitido' })
            : db.entities.Venta.update(id, { estado_comprobante: 'sunat_emitido' }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['ventas'] });
            qc.invalidateQueries({ queryKey: ['ventaspos'] });
        },
    });

    // Combinar y normalizar ventas
    const todasLasVentas = useMemo(() => {
        const h = ventasHotel.map(v => ({ ...v, _tipo: 'hotel' }));
        const p = ventasPOS.map(v => ({ ...v, _tipo: 'pos', fecha_pago: v.fecha_venta })); // Normalizar fecha
        return [...h, ...p].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }, [ventasHotel, ventasPOS]);

    const hoyStr = new Date().toISOString().split('T')[0];
    
    // Totales de HOY
    const totalesHoy = useMemo(() => {
        const deHoy = todasLasVentas.filter(v => (v.fecha_pago || v.fecha_venta || '').startsWith(hoyStr));
        return {
            total: deHoy.reduce((s, v) => s + (v.total || 0), 0),
            pos: deHoy.filter(v => v._tipo === 'pos').reduce((s, v) => s + (v.total || 0), 0),
            hotel: deHoy.filter(v => v._tipo === 'hotel').reduce((s, v) => s + (v.total || 0), 0),
        };
    }, [todasLasVentas, hoyStr]);

    const filtradas = todasLasVentas.filter(v => {
        const nombre = v.huesped_nombre || 'Cliente mostrador';
        const matchBusq = !busqueda || nombre.toLowerCase().includes(busqueda.toLowerCase()) || v.numero_ticket?.includes(busqueda) || v.habitacion_numero?.includes(busqueda);
        const matchMetodo = filtroMetodo === 'todos' || v.metodo_pago === filtroMetodo;
        const matchTipo = filtroTipo === 'todos' || v._tipo === filtroTipo;
        return matchBusq && matchMetodo && matchTipo;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground">Ventas & Tickets</h1>
                    <p className="text-muted-foreground mt-1">Historial combinado de Hotel y Minimarket</p>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider leading-none">Generado Hoy</p>
                        <p className="text-lg font-bold text-foreground leading-tight">S/ {totalesHoy.total.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Resumen Diario */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-amber-700" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">🛒 Minimarket Hoy</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">S/ {totalesHoy.pos.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Hotel className="w-4 h-4 text-blue-700" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">🏨 Hotel Hoy</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">S/ {totalesHoy.hotel.toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-5 col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-green-700" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase">📈 Total General</p>
                    </div>
                    <p className="text-2xl font-bold text-foreground">S/ {todasLasVentas.reduce((s, v) => s + (v.total || 0), 0).toFixed(0)}</p>
                </div>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar ticket, cliente..." className="pl-9" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger className="w-32 h-10 rounded-xl"><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="hotel">🏨 Hotel</SelectItem>
                            <SelectItem value="pos">🛒 POS</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1 bg-card border border-border p-1 rounded-xl">
                        {['todos', 'efectivo', 'yape', 'plin', 'tarjeta'].map(m => (
                            <button key={m} onClick={() => setFiltroMetodo(m)} className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                                filtroMetodo === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                            )}>
                                {m === 'todos' ? 'Todos' : metodoPagoIcon[m]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-secondary/30 text-left">
                                <th className="px-5 py-4 font-bold text-muted-foreground">Origen</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground">Ticket</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground">Cliente / Huésped</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground text-right">Total</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground">Pago</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground">Estado</th>
                                <th className="px-5 py-4 font-bold text-muted-foreground text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {filtradas.map(v => {
                                const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                                return (
                                    <tr key={`${v._tipo}-${v.id}`} className="hover:bg-secondary/20 transition-colors">
                                        <td className="px-5 py-4">
                                            {v._tipo === 'hotel' 
                                                ? <div className="flex items-center gap-1.5 text-blue-600 font-medium"><Hotel className="w-3.5 h-3.5" /> Hotel</div>
                                                : <div className="flex items-center gap-1.5 text-amber-600 font-medium"><ShoppingCart className="w-3.5 h-3.5" /> Minimarket</div>
                                            }
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="font-bold text-foreground">#{v.numero_ticket}</p>
                                            <p className="text-[10px] text-muted-foreground">{v.fecha_pago || v.fecha_venta}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="font-medium">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                            {v.habitacion_numero && <p className="text-[10px] text-muted-foreground">Hab. #{v.habitacion_numero}</p>}
                                        </td>
                                        <td className="px-5 py-4 text-right font-bold text-foreground">
                                            S/ {Number(v.total || 0).toFixed(2)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="capitalize text-xs">{metodoPagoIcon[v.metodo_pago]} {v.metodo_pago}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-bold border", comp.color)}>
                                                {comp.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => setVentaDetalle(v)} className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-all" title="Ver Ticket">
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                {v.estado_comprobante === 'sunat_pendiente' && (
                                                    <button
                                                        onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                                        className="p-2 rounded-lg hover:bg-blue-100 text-blue-600 transition-all"
                                                        title="Portal SUNAT"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filtradas.length === 0 && !loadHotel && !loadPOS && (
                                <tr>
                                    <td colSpan={7} className="text-center py-20 text-muted-foreground">
                                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p className="font-medium">No se encontraron ventas con estos filtros</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal ticket detalle */}
            {ventaDetalle && (
                <Dialog open onOpenChange={() => setVentaDetalle(null)}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="font-display">Ticket #{ventaDetalle.numero_ticket}</DialogTitle>
                        </DialogHeader>
                        
                        {ventaDetalle._tipo === 'pos' ? (
                            <TicketPOSPDF venta={ventaDetalle} config={config} />
                        ) : (
                            <TicketPDF venta={ventaDetalle} config={config} />
                        )}

                        {ventaDetalle.estado_comprobante === 'sunat_pendiente' && (
                            <Button
                                onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                className="w-full gap-2 bg-blue-600 hover:bg-blue-700 mt-2"
                            >
                                <ExternalLink className="w-4 h-4" /> Ir a Portal SUNAT
                            </Button>
                        )}
                        <Button variant="outline" className="w-full mt-2" onClick={() => setVentaDetalle(null)}>Cerrar</Button>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}