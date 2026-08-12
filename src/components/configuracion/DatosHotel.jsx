import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch.tsx';
import { Building2 } from 'lucide-react';

export function DatosHotel({ form, setForm }) {
    return (
        <div className="glass-panel rounded-[2rem] border border-border/50 p-8 space-y-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl -z-10 rounded-full pointer-events-none" />
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-foreground/5 rounded-2xl flex items-center justify-center border border-border/50 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]">
                    <Building2 className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_10px_currentColor] brightness-110" />
                </div>
                <div>
                    <h2 className="font-bold text-foreground text-lg">Datos del Hospedaje</h2>
                    <p className="text-xs text-foreground/60">Información fiscal y de contacto</p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Nombre del hospedaje *</Label>
                    <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Hospedaje Los Andes" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">RUC (opcional)</Label>
                    <Input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} placeholder="20XXXXXXXXX" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Ciudad</Label>
                    <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Cusco, Lima..." className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="sm:col-span-2 space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Dirección</Label>
                    <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Jr. Principal 123" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Teléfono / WhatsApp</Label>
                    <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 888 777" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-emerald-400 uppercase tracking-widest ml-1">Número Yape/Plin</Label>
                    <Input value={form.numero_yape} onChange={e => setForm({ ...form, numero_yape: e.target.value })} placeholder="Ej: 987654321" className="glass-panel border-emerald-500/30 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-foreground/50 uppercase tracking-widest ml-1">Email</Label>
                    <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hospedaje@email.com" className="glass-panel border-border/50 text-foreground placeholder:text-foreground/30 h-12 rounded-xl" />
                </div>
                <div className="space-y-2">
                    <Label className="text-xs font-black text-indigo-400 uppercase tracking-widest ml-1">Tipo de Cambio ($ → S/)</Label>
                    <Input type="number" step="0.01" value={form.tipo_cambio} onChange={e => setForm({ ...form, tipo_cambio: Number(e.target.value) })} placeholder="Ej: 3.80" className="glass-panel border-indigo-500/30 text-foreground placeholder:text-foreground/30 h-12 rounded-xl font-black" />
                </div>
                <div className="space-y-2 sm:col-span-2 pt-2">
                    <div className="flex items-center justify-between p-4 bg-foreground/5 rounded-xl border border-border/50">
                        <div className="space-y-0.5">
                            <Label className="text-sm font-bold text-foreground">El Hospedaje cobra IGV (18%)</Label>
                            <p className="text-xs text-foreground/60">Desactiva esto si tu hotel se encuentra en la Amazonía (zona exenta de IGV).</p>
                        </div>
                        <Switch checked={form.aplica_igv} onCheckedChange={(c) => setForm({...form, aplica_igv: c})} />
                    </div>
                </div>
            </div>
        </div>
    );
}
