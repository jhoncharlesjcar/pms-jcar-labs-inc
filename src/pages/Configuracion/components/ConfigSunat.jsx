import React from 'react';
import { Shield, ExternalLink } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function ConfigSunat({ form, setForm }) {
    const modoSunatInfo = {
        manual: { label: 'Manual (Recomendado para hospedajes pequeños)', desc: 'El recepcionista decide cuándo ir a SUNAT. Perfecto para operar con tickets internos.' },
        automatico: { label: 'Automático (Empresas formales)', desc: 'Recordatorio automático para emitir comprobante en cada venta.' },
        desactivado: { label: 'Desactivado', desc: 'Sin módulo SUNAT. Solo tickets internos.' },
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center border border-purple-500/20 shadow-xs">
                        <Shield className="w-4 h-4 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Módulo SUNAT</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Comprobantes electrónicos</p>
                    </div>
                </div>
                <button
                    onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                    className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
                >
                    <ExternalLink className="w-3.5 h-3.5" /> Portal SUNAT
                </button>
            </div>

            <div className="space-y-3">
                {Object.entries(modoSunatInfo).map(([key, info]) => (
                    <button
                        key={key}
                        onClick={() => setForm({ ...form, modo_sunat: key })}
                        className={cn(
                            "w-full text-left p-4 rounded-xl border-2 transition-all hover:-translate-y-1",
                            form.modo_sunat === key
                                ? "border-primary bg-primary/5 shadow-md"
                                : "border-border/40 bg-card/40 hover:border-primary/40 hover:bg-card/60 hover:shadow-sm"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                                form.modo_sunat === key ? "border-primary" : "border-border/60"
                            )}>
                                {form.modo_sunat === key && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                            </div>
                            <div>
                                <p className="font-extrabold text-foreground text-sm tracking-tight">{info.label}</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-0.5">{info.desc}</p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>

            {form.modo_sunat !== 'desactivado' && (
                    <div className="p-4 rounded-xl bg-card/60 border border-border/40 space-y-4 overflow-hidden shadow-sm">
                        <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Credenciales SOL SUNAT</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="sunat_ruc" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">RUC Emisor *</Label>
                                <Input 
                                    id="sunat_ruc"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={form.ruc} 
                                    onChange={e => setForm({ ...form, ruc: e.target.value })} 
                                    placeholder="Ej. 20601234567" 
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold font-mono tracking-wider tabular-nums" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sunat_usuario_sol" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Usuario SOL *</Label>
                                <Input 
                                    id="sunat_usuario_sol"
                                    value={form.sunat_usuario_sol} 
                                    onChange={e => setForm({ ...form, sunat_usuario_sol: e.target.value })} 
                                    placeholder="Ej. MODODATOS" 
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" 
                                />
                            </div>
                            <div className="sm:col-span-2 space-y-1.5">
                                <Label htmlFor="sunat_clave_sol" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Clave SOL *</Label>
                                <Input 
                                    id="sunat_clave_sol"
                                    type="password"
                                    value={form.sunat_clave_sol} 
                                    onChange={e => setForm({ ...form, sunat_clave_sol: e.target.value })} 
                                    placeholder="••••••••••••" 
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tracking-widest" 
                                />
                            </div>
                        </div>
                    </div>
                )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed font-bold shadow-xs">
                <strong className="font-black uppercase tracking-widest">Nota SUNAT Perú:</strong> El sistema guarda el historial completo de ventas para cumplir con la normativa. Cuando un cliente solicite comprobante, puedes emitirlo directamente en el portal web de SUNAT usando tu Clave SOL.
            </div>
        </div>
    );
}
