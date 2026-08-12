import { CalendarDays, Hotel, ShoppingCart, Printer, ExternalLink, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VentasDesktopTable({ filtradas, loadHotel, loadPOS, estadoComp, metodoPagoIcon, setVentaDetalle }) {
    return (
        <div className="hidden md:block bg-card rounded-2xl border p-1 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl -z-10 rounded-full pointer-events-none" />
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50 bg-foreground/5 text-left">
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px]">Origen</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px]">Ticket</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px]">Cliente</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px] text-right">Total</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px]">Pago</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px]">Estado</th>
                            <th className="px-6 py-5 font-bold text-foreground/50 uppercase tracking-wider text-[10px] text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                            {filtradas.map((v, idx) => {
                                const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                                return (
                                    <tr 
                                        key={`${v._tipo}-${v.id}`} 
                                        className="hover:bg-muted/50 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            {v._tipo === 'hotel' 
                                                ? <div className="flex items-center gap-2 text-blue-400 font-bold"><Hotel className="w-4 h-4 drop-shadow-[0_0_10px_currentColor] brightness-110" /> Hotel</div>
                                                : <div className="flex items-center gap-2 text-amber-400 font-bold"><ShoppingCart className="w-4 h-4 drop-shadow-[0_0_10px_currentColor] brightness-110" /> POS</div>
                                            }
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-foreground text-sm sm:text-base">
                                                #{v.numero_ticket || `T${(v.id || '').substring(0,6).toUpperCase()}`}
                                            </p>
                                            <p className="text-[10px] text-foreground/40 flex items-center gap-1 mt-0.5">
                                                <CalendarDays className="w-3 h-3" /> 
                                                {(() => {
                                                    const f = v.fecha_pago || v.fecha_venta || v.created_date;
                                                    if (!f) return '---';
                                                    return f.split('T')[0];
                                                })()}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-bold text-foreground truncate max-w-[150px]">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                            {v.habitacion_numero && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Habitación #{v.habitacion_numero}</p>}
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-foreground text-base">
                                            S/ {Number(v.total || 0).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-xs font-bold capitalize text-foreground">
                                                <span className="scale-125">{metodoPagoIcon[v.metodo_pago || 'efectivo']}</span>
                                                {v.metodo_pago || 'efectivo'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("text-[10px] px-2 py-1 rounded-lg font-black uppercase tracking-tighter border", comp.color)}>
                                                {comp.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => setVentaDetalle(v)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-foreground transition shadow-sm" title="Imprimir Ticket">
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                                {v.estado_comprobante === 'sunat_pendiente' && (
                                                    <button
                                                        onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                                                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-foreground transition shadow-sm"
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
                        
                        {(loadHotel || loadPOS) && (
                            <tr>
                                <td colSpan={7} className="py-24 text-center">
                                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin mx-auto" />
                                    <p className="text-sm font-bold text-foreground/50 mt-4 tracking-widest uppercase">Consultando base de datos...</p>
                                </td>
                            </tr>
                        )}
                        {filtradas.length === 0 && !loadHotel && !loadPOS && (
                            <tr>
                                <td colSpan={7} className="text-center py-32 text-foreground/60">
                                    <div className="bg-foreground/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-border/50 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]">
                                        <Receipt className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="text-lg font-bold text-foreground tracking-tight">No se encontraron tickets</p>
                                    <p className="text-sm font-medium mt-1">Prueba cambiando los filtros de búsqueda</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
