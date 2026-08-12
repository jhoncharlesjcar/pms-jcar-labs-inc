import React, { useState, useRef } from 'react';
import { CreditCard, QrCode, ShieldCheck, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import logger from '@/lib/logger';

export function ConfigPagos({ form, setForm }) {
    const [uploadingYape, setUploadingYape] = useState(false);
    const [uploadingPlin, setUploadingPlin] = useState(false);
    const [validating, setValidating] = useState(false);
    
    const yapeInputRef = useRef(null);
    const plinInputRef = useRef(null);

    const handleUploadQR = async (e, type) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('La imagen no debe superar los 2MB');
            return;
        }

        const setUploading = type === 'yape' ? setUploadingYape : setUploadingPlin;
        setUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `qr-${type}-${Date.now()}.${fileExt}`;
            const filePath = `qrs/${fileName}`;

            // Asumimos que el bucket se llama 'hoteles-assets' (como se acordó)
            const { error: uploadError } = await supabase.storage
                .from('hoteles-assets')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('hoteles-assets')
                .getPublicUrl(filePath);

            if (type === 'yape') {
                setForm({ ...form, qr_yape_url: publicUrl });
            } else {
                setForm({ ...form, qr_plin_url: publicUrl });
            }

            toast.success(`QR de ${type.toUpperCase()} subido exitosamente`);
        } catch (error) {
            logger.error(`Error subiendo QR de ${type}:`, error);
            toast.error(`Error al subir el QR. Verifica que el bucket "hoteles-assets" exista.`);
        } finally {
            setUploading(false);
        }
    };

    const handleValidarGateway = async () => {
        if (!form.pasarela_public_key || !form.pasarela_private_key) {
            toast.error('Ingresa ambas llaves para validar');
            return;
        }

        setValidating(true);
        try {
            // Llamada a la Edge Function
            const { data, error } = await supabase.functions.invoke('validate-gateway', {
                body: {
                    pasarela: form.pasarela_activa,
                    publicKey: form.pasarela_public_key,
                    privateKey: form.pasarela_private_key
                }
            });

            if (error) throw error;

            if (data?.valid) {
                toast.success('Credenciales validadas correctamente');
            } else {
                toast.error('Credenciales inválidas');
            }
        } catch (error) {
            logger.error('Error validando pasarela:', error);
            toast.error('Error de red al intentar validar las credenciales');
        } finally {
            setValidating(false);
        }
    };

    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center border border-amber-500/20 shadow-xs">
                        <CreditCard className="w-4 h-4 text-amber-500" />
                    </div>
                    <div>
                        <h2 className="font-extrabold text-lg text-foreground tracking-tight">Métodos de Cobro</h2>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Automático o Manual</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manual</span>
                    <Switch 
                        checked={form.modo_automatico} 
                        onCheckedChange={v => setForm({ ...form, modo_automatico: v })} 
                        className="data-[state=checked]:bg-amber-500"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Pasarela</span>
                </div>
            </div>

            {!form.modo_automatico ? (
                // MODO MANUAL (HU-07)
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                        Modo Manual: Sube los códigos QR estáticos de tus cuentas de Yape o Plin. Se mostrarán al cliente en la pantalla de cobro.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* QR Yape */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">QR Yape</Label>
                            <div 
                                className="border-2 border-dashed border-border/60 hover:border-primary/50 bg-background/30 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group relative h-40"
                                onClick={() => yapeInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={yapeInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleUploadQR(e, 'yape')}
                                />
                                {uploadingYape ? (
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                ) : form.qr_yape_url ? (
                                    <img src={form.qr_yape_url} alt="QR Yape" className="h-full object-contain rounded-md" />
                                ) : (
                                    <>
                                        <QrCode className="w-8 h-8 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-foreground">Subir QR Yape</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* QR Plin */}
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">QR Plin</Label>
                            <div 
                                className="border-2 border-dashed border-border/60 hover:border-primary/50 bg-background/30 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group relative h-40"
                                onClick={() => plinInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={plinInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={(e) => handleUploadQR(e, 'plin')}
                                />
                                {uploadingPlin ? (
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                ) : form.qr_plin_url ? (
                                    <img src={form.qr_plin_url} alt="QR Plin" className="h-full object-contain rounded-md" />
                                ) : (
                                    <>
                                        <QrCode className="w-8 h-8 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                                        <span className="text-xs font-bold text-foreground">Subir QR Plin</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                // MODO AUTOMÁTICO PASARELA (HU-06)
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Modo Automático: El sistema generará links de pago dinámicos. Las llaves se guardarán cifradas.
                    </div>
                    
                    <div className="p-4 rounded-xl bg-card/60 border border-border/40 space-y-4 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Pasarela de Pago *</Label>
                                <Select value={form.pasarela_activa} onValueChange={v => setForm({ ...form, pasarela_activa: v })}>
                                    <SelectTrigger className="h-9 bg-background/50 rounded-md border-border/40 text-xs font-bold shadow-inner">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="culqi">Culqi</SelectItem>
                                        <SelectItem value="izipay">Izipay</SelectItem>
                                        <SelectItem value="niubiz">Niubiz</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Llave Pública (PK) *</Label>
                                <Input 
                                    value={form.pasarela_public_key} 
                                    onChange={e => setForm({ ...form, pasarela_public_key: e.target.value })} 
                                    placeholder="pk_test_..." 
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-mono" 
                                />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Llave Privada (SK) *</Label>
                                <Input 
                                    type="password"
                                    value={form.pasarela_private_key} 
                                    onChange={e => setForm({ ...form, pasarela_private_key: e.target.value })} 
                                    placeholder="sk_test_..." 
                                    className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-mono tracking-widest" 
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border/40 flex justify-end">
                            <Button 
                                type="button" 
                                onClick={handleValidarGateway}
                                disabled={validating || !form.pasarela_public_key || !form.pasarela_private_key}
                                variant="outline"
                                className="h-8 px-4 text-xs font-bold gap-2"
                            >
                                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />}
                                Validar Credenciales
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
