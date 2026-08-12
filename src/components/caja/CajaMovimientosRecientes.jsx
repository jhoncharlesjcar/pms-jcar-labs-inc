import { History, Calendar, User, MinusCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CajaMovimientosRecientes({ filteredEgresos, filterTab, setFilterTab }) {
    return (
        <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="font-bold text-lg flex items-center gap-2 text-foreground">
                    <History className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    Movimientos Recientes
                </h3>
                <div className="flex gap-2">
                    {['hoy', 'semana', 'todos'].map(t => (
                        <button
                            key={t}
                            onClick={() => setFilterTab(t)}
                            className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition",
                                filterTab === t ? "bg-foreground/10 text-foreground shadow-sm" : "bg-foreground/5 text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {filteredEgresos.length > 0 ? (
                    filteredEgresos.slice(0, 10).map((e, idx) => (
                        <div 
                            key={e.id}
                            className="glass-panel p-3 sm:p-4 rounded-[1.25rem] sm:rounded-2xl flex items-center justify-between hover:bg-foreground/5 transition border-l-4 border-l-red-500/50 shadow-sm"
                        >
                            <div className="flex items-center gap-3 sm:gap-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]">
                                    <MinusCircle className="w-5 h-5 text-red-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                                </div>
                                <div>
                                    <p className="font-bold text-xs sm:text-sm text-foreground">{e.concepto || 'Egreso sin concepto'}</p>
                                    <div className="flex items-center gap-2 text-xs sm:text-xs text-foreground/60 mt-0.5">
                                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        <span className="truncate max-w-[80px] sm:max-w-none">{format(new Date(e.fecha || e.created_date), "dd MMM, HH:mm", { locale: es })}</span>
                                        <span className="opacity-30">•</span>
                                        <User className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                        <span className="truncate max-w-[60px] sm:max-w-none">{e.usuario_nombre || 'Staff'}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-black text-red-400 drop-shadow-sm">- S/ {Number(e.monto).toFixed(2)}</p>
                                <span className="text-xs font-bold uppercase tracking-tighter text-foreground/40">{e.categoria || 'Operativo'}</span>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-20 glass-panel border border-dashed border-border/50 rounded-3xl">
                        <AlertCircle className="w-10 h-10 text-foreground/30 mx-auto mb-4" />
                        <p className="text-foreground/60 font-medium">No se registran egresos recientes</p>
                    </div>
                )}
            </div>
        </div>
    );
}
