import { Building2, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuditCenter({ hoteles, habitaciones, reservas, ventas, usuarios }) {
    return (
        <div className="space-y-4">
            <p className="font-semibold text-foreground">Auditoría Global del Sistema</p>

            <div className="grid gap-4">
                {hoteles.map(h => {
                    const habsH = habitaciones.filter(hab => hab.hotel_id === h.id);
                    const resH = reservas.filter(r => r.hotel_id === h.id);
                    const venH = ventas.filter(v => v.hotel_id === h.id);
                    const staffH = usuarios.filter(u => u.hotel_id === h.id);
                    const ingresos = venH.reduce((s, v) => s + (v.total || 0), 0);
                    const ocupacion = habsH.length > 0 ? Math.round((habsH.filter(hb => hb.estado === 'ocupada').length / habsH.length) * 100) : 0;

                    return (
                        <div key={h.id} className="bg-card border border-border rounded-2xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                                        <Building2 className="w-5 h-5 text-amber-600" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-foreground">{h.nombre}</p>
                                        <p className="text-xs text-muted-foreground">{h.ciudad}</p>
                                    </div>
                                </div>
                                <span className={cn("text-xs px-2 py-1 rounded-full border font-medium",
                                    h.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-secondary-foreground border-border")}>
                                    {h.activo ? 'Operativo' : 'Inactivo'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-foreground">{habsH.length}</p>
                                    <p className="text-[10px] text-muted-foreground">Habitaciones</p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-green-600">{resH.filter(r => r.estado === 'activa').length}</p>
                                    <p className="text-[10px] text-muted-foreground">Reservas activas</p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-primary">S/ {ingresos.toFixed(0)}</p>
                                    <p className="text-[10px] text-muted-foreground">Ingresos totales</p>
                                </div>
                                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                                    <p className="text-lg font-bold text-foreground">{staffH.length}</p>
                                    <p className="text-[10px] text-muted-foreground">Staff asignado</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Ocupación</span>
                                    <span>{ocupacion}%</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-2">
                                    <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${ocupacion}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })}

                {hoteles.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-border rounded-2xl text-muted-foreground">
                        <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Registra hoteles para ver la auditoría</p>
                    </div>
                )}
            </div>
        </div>
    );
}
