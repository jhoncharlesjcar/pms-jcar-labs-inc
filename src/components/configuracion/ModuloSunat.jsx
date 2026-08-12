import { Shield, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ModuloSunat({ form, setForm }) {
    const modoSunatInfo = {
        manual: { label: 'Manual (Recomendado para hospedajes pequeños)', desc: 'El recepcionista decide cuándo ir a SUNAT. Perfecto para operar con tickets internos.' },
        automatico: { label: 'Automático (Empresas formales)', desc: 'Recordatorio automático para emitir comprobante en cada venta.' },
        desactivado: { label: 'Desactivado', desc: 'Sin módulo SUNAT. Solo tickets internos.' },
    };

    return (
        <div className="glass-panel rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-foreground/5 rounded-2xl flex items-center justify-center border border-purple-500/20 shadow-[inset_0_0_15px_rgba(168,85,247,0.1)]">
                        <Shield className="w-5 h-5 text-purple-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                    </div>
                    <div>
                        <h2 className="font-bold text-foreground text-lg">Módulo SUNAT</h2>
                        <p className="text-xs text-foreground/60">Comprobantes electrónicos</p>
                    </div>
                </div>
                <button
                    onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                    className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-bold"
                >
                    <ExternalLink className="w-3.5 h-3.5" /> Ir al portal SUNAT
                </button>
            </div>

            <div className="space-y-3">
                {Object.entries(modoSunatInfo).map(([key, info]) => (
                    <button
                        key={key}
                        onClick={() => setForm({ ...form, modo_sunat: key })}
                        className={cn(
                            "w-full text-left p-5 rounded-2xl border transition",
                            form.modo_sunat === key
                                ? "border-indigo-400 bg-foreground/5 shadow-[inset_0_0_15px_rgba(99,102,241,0.1)] text-foreground"
                                : "border-border/50 bg-foreground/5 hover:border-border/50 hover:bg-foreground/5 text-foreground/60 hover:text-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition",
                                form.modo_sunat === key ? "border-indigo-400" : "border-border/50"
                            )}>
                                {form.modo_sunat === key && <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />}
                            </div>
                            <p className={cn("font-bold text-sm transition", form.modo_sunat === key ? "text-foreground" : "text-foreground/80")}>{info.label}</p>
                        </div>
                        <p className={cn("text-xs mt-1.5 ml-8 transition", form.modo_sunat === key ? "text-foreground/80" : "text-foreground/50")}>{info.desc}</p>
                    </button>
                ))}
            </div>

            <div className="glass-panel border border-blue-500/20 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)] rounded-2xl p-5 text-xs text-blue-400 leading-relaxed relative">
                <strong>Nota SUNAT Perú:</strong> El sistema guarda el historial completo de ventas para cumplir con la normativa. Cuando un cliente solicite comprobante, puedes emitirlo directamente en el portal web de SUNAT usando tu Clave SOL.
            </div>
        </div>
    );
}
