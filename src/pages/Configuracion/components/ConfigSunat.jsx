import React, { useRef } from 'react';
import { Shield, ExternalLink, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function SecretFileField({ id, label, accept, hint, value, onContent }) {
    const ref = useRef(null);
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id} className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    ref={ref}
                    id={id}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                            onContent(String(reader.result || '').trim());
                            toast.success(`${label} cargado (${file.name})`);
                        };
                        reader.onerror = () => toast.error('No se pudo leer el archivo');
                        reader.readAsText(file);
                        e.target.value = '';
                    }}
                />
                <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-[10px] font-bold text-foreground hover:bg-muted/40 transition-colors"
                >
                    <Upload className="h-3.5 w-3.5" /> Subir {label}
                </button>
                <span className={cn('text-[9px] font-bold truncate', value ? 'text-emerald-500' : 'text-muted-foreground')}>
                    {value ? '✓ Cargado' : (hint || 'Ningún archivo')}
                </span>
            </div>
        </div>
    );
}

export function ConfigSunat({ form, setForm }) {
    const modoSunatInfo = {
        manual: { label: 'Manual (Recomendado para hospedajes pequeños)', desc: 'El recepcionista decide cuándo emitir a SUNAT. Perfecto para operar con tickets internos.' },
        automatico: { label: 'Automático (Empresas formales)', desc: 'Emisión automática del comprobante en cada venta al registrar el cobro.' },
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
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Facturación electrónica SOAP directa</p>
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

                    <div className="border-t border-border/40 pt-4 space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-foreground">Certificado digital ICP</p>
                        <SecretFileField
                            id="sunat_cert"
                            label="Certificado (.pem/.cer/.crt)"
                            accept=".pem,.cer,.crt,.txt"
                            hint="Archivo del certificado emitido por tu ICP"
                            value={form.sunat_certificado_pem}
                            onContent={(v) => setForm({ ...form, sunat_certificado_pem: v })}
                        />
                        <SecretFileField
                            id="sunat_key"
                            label="Clave privada (.pem/.key)"
                            accept=".pem,.key,.txt"
                            hint="Archivo de la clave privada del certificado"
                            value={form.sunat_cert_private_key_pem}
                            onContent={(v) => setForm({ ...form, sunat_cert_private_key_pem: v })}
                        />
                        <p className="text-[9px] text-muted-foreground font-medium leading-relaxed">
                            Si tu ICP te entregó un archivo <strong>.pfx</strong>, conviértelo con OpenSSL:
                            <code className="block mt-1 bg-background/60 rounded px-2 py-1 text-[9px]">openssl pkcs12 -in certificado.pfx -out cert.pem -clcerts -nokeys && openssl pkcs12 -in certificado.pfx -out key.pem -nocerts -nodes</code>
                        </p>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-card/60 rounded-xl border border-border/40 shadow-sm">
                        <div className="space-y-1">
                            <Label htmlFor="sunat_modo_prueba" className="text-sm font-extrabold text-foreground tracking-tight">Modo de prueba (sandbox)</Label>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Actívalo para probar con SUNAT beta. Desactívalo para producción real.</p>
                        </div>
                        <Switch
                            id="sunat_modo_prueba"
                            checked={form.sunat_modo_prueba}
                            onCheckedChange={(checked) => setForm({ ...form, sunat_modo_prueba: checked })}
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-[10px] text-blue-600 dark:text-blue-400 leading-relaxed font-bold shadow-xs">
                <strong className="font-black uppercase tracking-widest">Nota SUNAT Perú:</strong> El sistema firma el XML con tu certificado ICP y envía directo a SUNAT por SOAP. En producción desactiva el modo de prueba y verifica que tu RUC, ubigeo y dirección fiscal sean correctos.
            </div>
        </div>
    );
}
