import { History, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function CajaHistorialCierres({ cierres }) {
    return (
        <div className="space-y-6">
            <h3 className="font-bold text-lg px-2 flex items-center gap-2 text-foreground">
                <History className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                Historial de Cierres
            </h3>

            <div className="space-y-4">
                {cierres.length > 0 ? (
                    cierres.slice(0, 5).map((c, idx) => (
                        <div key={c.id} className="glass-panel p-5 rounded-3xl border-t-4 border-t-indigo-500/50 relative overflow-hidden shadow-sm">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-1 drop-shadow-sm">Cierre de Caja</p>
                                    <p className="font-bold text-sm text-foreground">{format(new Date(c.fecha || c.created_date), "EEEE, d 'de' MMMM", { locale: es })}</p>
                                </div>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                                <div>
                                    <p className="text-xs text-foreground/50 uppercase font-bold tracking-tight">Total Ventas</p>
                                    <p className="font-black text-xs text-foreground">S/ {Number(c.total_ventas).toFixed(2)}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-foreground/50 uppercase font-bold tracking-tight">Saldo Final</p>
                                    <p className="font-black text-xs text-indigo-400 drop-shadow-sm">S/ {Number(c.saldo_final).toFixed(2)}</p>
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center overflow-hidden border border-border/50">
                                    <span className="text-xs font-bold text-foreground">{(c.usuario_nombre || '?')[0]}</span>
                                </div>
                                <p className="text-xs text-foreground/60 italic">Cerrado por {c.usuario_nombre || 'Sistema'}</p>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 glass-panel border border-dashed border-border/50 rounded-3xl">
                        <p className="text-xs text-foreground/60 italic">Aún no hay cierres registrados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
