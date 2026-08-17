import React from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowUpRight, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Helper: generar color determinístico de avatar por nombre */
function getAvatarColor(name) {
    const colors = ['from-emerald-500 to-teal-600', 'from-blue-500 to-indigo-600', 'from-purple-500 to-violet-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
}

export const RecentActivity = ({ cardRef, todasLasVentas }) => {
    return (
        <div ref={cardRef} className="enterprise-card section-card ui-card-pad col-span-2 flex flex-col transition-all duration-300 ease-out lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-foreground tracking-tight">Actividad Reciente</h3>
                </div>
                <Link to="/ventas">
                    <span className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">Ver Historial <ArrowUpRight className="w-3 h-3" /></span>
                </Link>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {[...todasLasVentas].sort((r, s) => new Date(s.fecha_pago || s.created_date).getTime() - new Date(r.fecha_pago || r.created_date).getTime()).slice(0, 5).map((r) => {
                    const nombre = r.huesped_nombre || 'Cliente Final';
                    const initials = nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    const fecha = r.fecha_pago || r.created_date;
                    const timeAgo = fecha ? formatDistanceToNow(new Date(fecha), { addSuffix: true, locale: es }) : '';

                    return (
                        <div key={`${r._tipo}-${r.id}`} className="flex items-center justify-between p-3 bg-muted/20 rounded-xl hover:bg-muted/40 transition-colors group/item">
                            <div className="flex items-center gap-2.5">
                                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold bg-gradient-to-br shadow-sm", getAvatarColor(nombre))}>
                                    {initials}
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-foreground leading-tight">{nombre}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <span className="text-[10px] text-muted-foreground">
                                            {r._tipo === "pos" ? "Tienda (POS)" : (r.habitacion_numero ? `Hab. ${r.habitacion_numero}` : "Recepción")}
                                        </span>
                                        <span className="text-muted-foreground/30">•</span>
                                        <span className="text-[10px] text-muted-foreground/70">{timeAgo}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold tabular-nums text-foreground tracking-tight">S/ {Number(r.total || 0).toFixed(2)}</p>
                                <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{r.metodo_pago}</p>
                            </div>
                        </div>
                    );
                })}
                {todasLasVentas.length === 0 && (
                    <div className="p-6 text-center text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">No hay actividad reciente</p>
                    </div>
                )}
            </div>
        </div>
    );
};
