import { memo } from 'react';
import { Receipt, Search, ExternalLink, Printer, TrendingUp, ShoppingCart, Hotel, CalendarDays, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import TicketPDF from '@/components/TicketPDF';
import TicketPOSPDF from '@/components/pos/TicketPOSPDF';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { YapeIcon, PlinIcon, EfectivoIcon, TarjetaIcon } from '@/components/PaymentIcons';

import EmptyState from '@/components/common/EmptyState';
import { useGsapStaggerList } from '@/hooks/useGsapStaggerList';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ComprobanteBoton from '@/components/comprobantes/ComprobanteBoton';

import { useVentasData } from './Ventas/hooks/useVentasData';

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

const Ventas = memo(function Ventas() {
    const {
        qc, busqueda, setBusqueda, filtroMetodo, setFiltroMetodo, filtroTipo, setFiltroTipo,
        ventaDetalle, setVentaDetalle, todasLasVentas, totalesHoy, filtradas, config,
        loadHotel, loadPOS
    } = useVentasData();

    const tableBodyRef = useGsapStaggerList([filtradas.length, loadHotel, loadPOS], {
        stagger: 0.04,
        direction: 'y',
        distance: 8,
    });

    const mobileListRef = useGsapStaggerList([filtradas.length, loadHotel, loadPOS], {
        stagger: 0.04,
        direction: 'y',
        distance: 10,
    });

    return (
        <div className="page-shell page-enter mx-auto max-w-7xl pt-1">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-sm">
                            <Receipt className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter leading-none">Ventas y Tickets</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Historial consolidado de hotel y minimarket
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center sm:justify-end gap-3 w-full sm:w-auto">
                    <div className="enterprise-card section-card flex w-full flex-col justify-center px-4 py-3 text-right sm:w-auto">
                        <div className="flex items-center justify-end gap-2 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Caja Hoy</p>
                        </div>
                        <p className="text-3xl font-extrabold text-primary leading-none tabular-nums tracking-tighter">S/ {totalesHoy.total.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            {/* Resumen Cards */}
            <div className="ui-card-grid grid grid-cols-1 sm:grid-cols-3">
                {[
                    { label: 'Minimarket Hoy', val: totalesHoy.pos, icon: ShoppingCart, color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20', bg: 'bg-amber-500/10', hover: 'hover:border-amber-500/40 hover:-translate-y-1' },
                    { label: 'Hotel Hoy', val: totalesHoy.hotel, icon: Hotel, color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/10', hover: 'hover:border-blue-500/40 hover:-translate-y-1' },
                    { label: 'Total Histórico', val: todasLasVentas.reduce((s, v) => s + Number(v.total || 0), 0), icon: Wallet, color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/10', hover: 'hover:border-emerald-500/40 hover:-translate-y-1' },
                ].map((stat) => (
                    <div 
                        key={stat.label}
                        className={cn("enterprise-card metric-card ui-card-pad relative overflow-hidden group transition-all duration-300 hover:shadow-md", stat.hover)}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-6 h-6 rounded-md flex items-center justify-center font-bold flex-shrink-0 border shadow-sm", stat.bg, stat.border)}>
                                <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
                            </div>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-foreground tracking-tight leading-none mt-1">S/ {stat.val.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-2xl border border-border/80 shadow-xs items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                        value={busqueda} 
                        onChange={e => setBusqueda(e.target.value)} 
                        placeholder="Buscar por ticket, cliente o habitación..." 
                        className="pl-11 h-12 bg-background/50 border-border/40 rounded-xl text-sm font-semibold focus-visible:ring-primary/30 focus-visible:border-primary/50 shadow-sm w-full" 
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger className="w-full sm:w-40 h-12 rounded-xl bg-background/50 border-border/40 text-xs font-bold uppercase tracking-widest"><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="todos" className="font-bold text-xs">Todos los tipos</SelectItem>
                            <SelectItem value="hotel" className="font-bold text-xs">🏨 Hotel</SelectItem>
                            <SelectItem value="pos" className="font-bold text-xs">🛒 POS</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="flex gap-1.5 bg-muted/50 border border-border/40 p-1.5 rounded-xl overflow-x-auto w-full sm:w-auto">
                        {['todos', 'efectivo', 'yape', 'plin', 'tarjeta'].map(m => (
                            <button key={m} onClick={() => setFiltroMetodo(m)} className={cn(
                                "px-3 py-2 rounded-lg text-[10px] font-extrabold uppercase tracking-widest transition-all whitespace-nowrap",
                                filtroMetodo === m ? "bg-background text-primary shadow-sm border border-border/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}>
                                <span className="flex items-center gap-1.5">
                                    {m !== 'todos' && <span className="scale-110">{metodoPagoIcon[m]}</span>}
                                    {m === 'todos' ? 'Todos' : m}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border/50 bg-secondary/10 text-left">
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Origen</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Ticket</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Cliente</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-right whitespace-nowrap">Total</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Pago</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs">Estado</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Comprobante</th>
                                <th className="px-4 py-3 font-medium text-muted-foreground text-xs text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody ref={/** @type {any} */ (tableBodyRef)} className="divide-y divide-border/20">
                                {filtradas.map((v) => {
                                    const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                                    return (
                                        <tr
                                            key={`${v._tipo}-${v.id}`}
                                            className="hover:bg-muted/30 transition-colors group"
                                        >
                                            <td className="px-4 py-2.5">
                                                {v._tipo === 'hotel' 
                                                    ? <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium text-xs"><Hotel className="w-3.5 h-3.5" /> Hotel</div>
                                                    : <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-xs"><ShoppingCart className="w-3.5 h-3.5" /> POS</div>
                                                }
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-foreground text-sm">#{v.numero_ticket}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <CalendarDays className="w-3 h-3" /> 
                                                    {format(new Date(v.fecha_pago || v.fecha_venta || v.created_date), "dd MMM, HH:mm", { locale: es })}
                                                </p>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <p className="font-medium text-foreground text-sm truncate max-w-[150px]">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                                {v.habitacion_numero && <p className="text-xs text-muted-foreground mt-0.5">Habitación #{v.habitacion_numero}</p>}
                                            </td>
                                            <td className="px-4 py-2.5 text-right font-medium text-foreground text-sm tabular-nums whitespace-nowrap">
                                                S/ {Number(v.total || 0).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                                    <span className="scale-110">{metodoPagoIcon[v.metodo_pago]}</span>
                                                    <span className="capitalize">{v.metodo_pago}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center h-8">
                                                    <span className={cn("text-xs px-2.5 py-1 rounded-md font-medium border whitespace-nowrap", comp.color)}>
                                                        {comp.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <div className="flex items-center justify-center h-8">
                                                    <ComprobanteBoton
                                                        ventaPos={v}
                                                        hotel={config}
                                                        variant="compact"
                                                        onEmitido={() => qc.invalidateQueries({ queryKey: ['ventaspos'] })}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center justify-center gap-2 h-8">
                                                    <button onClick={() => setVentaDetalle(v)} className="w-8 h-8 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex items-center justify-center transition-all shadow-xs active:scale-95" title="Imprimir Ticket">
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                    {v.estado_comprobante === 'sunat_pendiente' && (
                                                        <button
                                                            onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                                            className="w-8 h-8 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-all shadow-xs active:scale-95"
                                                            title="Portal SUNAT"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

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
                                    <td colSpan={7}>
                                        <EmptyState
                                            icon={Receipt}
                                            title="Sin resultados"
                                            description="Ajusta los filtros o prueba con otro término de búsqueda para encontrar lo que buscas."
                                            className="py-16"
                                        />
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
 
            {/* Mobile Cards View */}
            <div ref={mobileListRef} className="grid grid-cols-1 gap-3 md:hidden">
                    {filtradas.map((v) => {
                        const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                        return (
                            <div
                                key={`mob-${v._tipo}-${v.id}`}
                                className="enterprise-card section-card ui-card-pad flex flex-col gap-4 shadow-sm transition-shadow hover:shadow-md"
                            >
                                <div className="flex items-center justify-between">
                                    <div className={cn("text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-xs", v._tipo === 'hotel' ? "text-blue-600 dark:text-blue-400 border-blue-500/20 bg-blue-500/10" : "text-amber-600 dark:text-amber-400 border-amber-500/20 bg-amber-500/10")}>
                                        {v._tipo === 'hotel' ? 'Hotel' : 'Minimarket'}
                                    </div>
                                    <span className={cn("text-[9px] px-2.5 py-1 rounded-md font-black uppercase tracking-widest border shadow-xs", comp.color)}>
                                        {comp.label}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-extrabold text-sm text-foreground tracking-tight">#{v.numero_ticket}</p>
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest truncate max-w-[180px] mt-0.5">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-extrabold text-foreground tabular-nums tracking-tighter">S/ {Number(v.total || 0).toFixed(2)}</p>
                                        <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
                                            <span className="scale-110">{metodoPagoIcon[v.metodo_pago]}</span>
                                            <span>{v.metodo_pago}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-3 border-t border-border/20">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                                        <CalendarDays className="w-3.5 h-3.5" /> {format(new Date(v.created_date || v.fecha_venta), "dd MMM, HH:mm", { locale: es })}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <ComprobanteBoton
                                            ventaPos={v}
                                            hotel={config}
                                            variant="icon"
                                            onEmitido={() => qc.invalidateQueries({ queryKey: ['ventaspos'] })}
                                        />
                                        <button aria-label="Imprimir ticket" onClick={() => setVentaDetalle(v)} className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary shadow-xs transition-all active:scale-95">
                                            <Printer className="w-4 h-4" />
                                        </button>
                                        {v.estado_comprobante === 'sunat_pendiente' && (
                                            <button aria-label="Abrir portal SUNAT" onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')} className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shadow-xs transition-all active:scale-95 dark:text-blue-400">
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
            </div>

            {/* Modal ticket detalle con Glassmorphism */}
            {ventaDetalle && (
                    <Dialog open onOpenChange={() => setVentaDetalle(null)}>
                        <DialogContent className="max-w-md bg-card border border-border shadow-xl rounded-[2rem] p-4 sm:p-8 overflow-x-hidden">
                            <DialogHeader>
                                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 border border-primary/20 shadow-sm text-primary">
                                    <Receipt className="w-6 h-6" />
                                </div>
                                <DialogTitle className="text-2xl font-extrabold text-center tracking-tight">Detalle de Ticket</DialogTitle>
                                <p className="text-center text-muted-foreground text-[11px] uppercase tracking-widest font-bold mt-1">Ticket #{ventaDetalle.numero_ticket}</p>
                            </DialogHeader>
                            
                            <div className="mt-6 p-3 sm:p-5 bg-background/50 rounded-2xl border border-border/40 shadow-inner overflow-x-auto custom-scrollbar">
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
                                        className="h-12 rounded-xl gap-2 bg-blue-600 hover:bg-blue-700 shadow-md font-extrabold text-sm active:scale-95 transition-all"
                                    >
                                        <ExternalLink className="w-4 h-4" /> Declarar en SUNAT
                                    </Button>
                                )}
                                <Button className="h-12 rounded-xl shadow-md font-extrabold text-sm active:scale-95 transition-all" onClick={() => window.print()}>
                                    <Printer className="w-4 h-4 mr-2" /> Imprimir Copia
                                </Button>
                                <Button variant="ghost" className="h-12 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-muted" onClick={() => setVentaDetalle(null)}>
                                    Cerrar
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
        </div>
    );
});
Ventas.displayName = 'Ventas';
export default Ventas;
