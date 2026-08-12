import { memo } from 'react';
import { Building2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const AuditCenter = memo(function AuditCenter({ hoteles, habitaciones, reservas, ventas, usuarios }) {
    return (
        <div className="space-y-3">
            <p className="font-extrabold text-sm tracking-tight text-foreground">Auditoría Global del Sistema</p>

            <div className="grid gap-3">
                {hoteles.map(h => {
                    const habsH = habitaciones.filter(hab => hab.hotel_id === h.id);
                    const resH = reservas.filter(r => r.hotel_id === h.id);
                    const venH = ventas.filter(v => v.hotel_id === h.id);
                    const staffH = usuarios.filter(u => u.hotel_id === h.id);
                    
                    // Cálculo de ingresos incluyendo POS (asumiendo que ventas_pos se pasará o se buscará de alguna forma)
                    // Por ahora, corregimos el reduce existente
                    const ingresos = venH.reduce((s, v) => s + Number(v.total || 0), 0);
                    const ocupacion = habsH.length > 0 ? Math.round((habsH.filter(hb => hb.estado === 'ocupada').length / habsH.length) * 100) : 0;

                    return (
                        <div key={h.id} className="bg-card/40 backdrop-blur-xl border border-border/40 rounded-xl p-4 space-y-3 shadow-sm hover:border-amber-500/30 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-center shadow-xs">
                                        <Building2 className="w-4 h-4 text-amber-500" />
                                    </div>
                                    <div>
                                        <p className="font-extrabold tracking-tight text-sm text-foreground">{h.nombre}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{h.ciudad}</p>
                                    </div>
                                </div>
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border",
                                    h.activo ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400" : "bg-secondary text-secondary-foreground border-border/40")}>
                                    {h.activo ? 'Operativo' : 'Inactivo'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="bg-card/60 border border-border/40 rounded-lg p-2.5 text-center shadow-xs">
                                    <p className="text-base font-extrabold tracking-tight text-foreground leading-none mb-1">{habsH.length}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Habitaciones</p>
                                </div>
                                <div className="bg-card/60 border border-border/40 rounded-lg p-2.5 text-center shadow-xs">
                                    <p className="text-base font-extrabold tracking-tight text-green-600 dark:text-green-500 leading-none mb-1">{resH.filter(r => r.estado === 'activa').length}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reservas act.</p>
                                </div>
                                <div className="bg-card/60 border border-border/40 rounded-lg p-2.5 text-center shadow-xs">
                                    <p className="text-base font-extrabold tracking-tight text-primary leading-none mb-1">S/ {ingresos.toFixed(0)}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ingresos</p>
                                </div>
                                <div className="bg-card/60 border border-border/40 rounded-lg p-2.5 text-center shadow-xs">
                                    <p className="text-base font-extrabold tracking-tight text-foreground leading-none mb-1">{staffH.length}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Staff</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">
                                    <span>Ocupación</span>
                                    <span>{ocupacion}%</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden border border-border/40">
                                    <div className="bg-amber-500 h-1.5 transition-all duration-500" style={{ width: `${ocupacion}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}

                {hoteles.length === 0 && (
                    <div className="text-center py-8 border border-dashed border-border/40 rounded-xl text-muted-foreground bg-card/20">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Registra hoteles para ver la auditoría</p>
                    </div>
                )}
            </div>
        </div>
    );
});
AuditCenter.displayName = 'AuditCenter';
export default AuditCenter;
