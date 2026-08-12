import { CalendarDays, Printer, ExternalLink, Hotel, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

export function VentasMobileList({ filtradas, estadoComp, metodoPagoIcon, setVentaDetalle }) {
    return (
        <div className="grid grid-cols-1 gap-3 md:hidden">
                {filtradas.map((v, idx) => {
                    const comp = estadoComp[v.estado_comprobante] || estadoComp.ticket_interno;
                    const isHotel = v._tipo === 'hotel';
                    return (
                        <div
                            key={`mob-${v._tipo}-${v.id}`}
                            className="glass-panel p-4 rounded-2xl border border-border/50 flex flex-col gap-3 shadow-sm"
                        >
                            <div className="flex justify-between items-start gap-4">
                                <div className="flex gap-3">
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border", isHotel ? "bg-foreground/5 text-blue-400 border-blue-500/20 shadow-[inset_0_0_10px_rgba(59,130,246,0.1)]" : "bg-foreground/5 text-amber-400 border-amber-500/20 shadow-[inset_0_0_10px_rgba(245,158,11,0.1)]")}>
                                        {isHotel ? <Hotel className="w-5 h-5 drop-shadow-[0_0_10px_currentColor] brightness-110" /> : <ShoppingCart className="w-5 h-5 drop-shadow-[0_0_10px_currentColor] brightness-110" />}
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground text-sm">#{v.numero_ticket || `T${(v.id || '').substring(0,6).toUpperCase()}`}</p>
                                        <p className="font-bold text-foreground text-[11px] truncate max-w-[140px] mt-0.5">{v.huesped_nombre || 'Cliente mostrador'}</p>
                                        {v.habitacion_numero && <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Habitación #{v.habitacion_numero}</p>}
                                        <div className="text-[10px] text-foreground/50 flex items-center gap-1 mt-1">
                                            <CalendarDays className="w-3 h-3" /> 
                                            {(() => {
                                                const f = v.fecha_pago || v.fecha_venta || v.created_date;
                                                if (!f) return '---';
                                                return f.split('T')[0];
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-foreground text-base">S/ {Number(v.total || 0).toFixed(2)}</p>
                                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-medium capitalize text-foreground/60 mt-1">
                                        <span>{metodoPagoIcon[v.metodo_pago || 'efectivo']}</span>
                                        {v.metodo_pago || 'efectivo'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className={cn("text-[8px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter border", comp.color)}>
                                    {comp.label}
                                </span>
                                <div className="flex gap-2">
                                    <button onClick={() => setVentaDetalle(v)} className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500 hover:text-foreground transition">
                                        <Printer className="w-3.5 h-3.5" />
                                    </button>
                                    {v.estado_comprobante === 'sunat_pendiente' && (
                                        <button onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')} className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500 hover:text-foreground transition">
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            
        </div>
    );
}
