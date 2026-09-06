import React from 'react';
import { Building2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function ConfigDatosHotel({ form, setForm }) {
    return (
        <div className="bg-card/40 backdrop-blur-xl rounded-xl border border-border/40 p-5 space-y-5 shadow-sm">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 shadow-xs">
                    <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div>
                    <h2 className="font-extrabold text-lg text-foreground tracking-tight">Datos del Hospedaje</h2>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Información fiscal y de contacto</p>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="hotel_nombre" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre del hospedaje *</Label>
                    <Input id="hotel_nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Hospedaje Los Andes" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_ruc" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">RUC *</Label>
                    <Input id="hotel_ruc" value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} placeholder="20XXXXXXXXX" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tabular-nums" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_razon_social" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Razón social *</Label>
                    <Input id="hotel_razon_social" value={form.razon_social} onChange={e => setForm({ ...form, razon_social: e.target.value })} placeholder="Nombre legal del negocio" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_ciudad" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Ciudad</Label>
                    <Input id="hotel_ciudad" value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Cusco, Lima..." className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                    <Label htmlFor="hotel_direccion" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Dirección fiscal *</Label>
                    <Input id="hotel_direccion" value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Jr. Principal 123" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_ubigeo" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Ubigeo (6 dígitos) *</Label>
                    <Input id="hotel_ubigeo" value={form.ubigeo} onChange={e => setForm({ ...form, ubigeo: e.target.value })} inputMode="numeric" maxLength={6} placeholder="Ej. 080101" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tabular-nums" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_departamento" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Departamento</Label>
                    <Input id="hotel_departamento" value={form.departamento} onChange={e => setForm({ ...form, departamento: e.target.value })} placeholder="Cusco" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_provincia" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Provincia</Label>
                    <Input id="hotel_provincia" value={form.provincia} onChange={e => setForm({ ...form, provincia: e.target.value })} placeholder="Cusco" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_distrito" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Distrito</Label>
                    <Input id="hotel_distrito" value={form.distrito} onChange={e => setForm({ ...form, distrito: e.target.value })} placeholder="Cusco" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_telefono" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono / WhatsApp</Label>
                    <Input id="hotel_telefono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 888 777" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold tabular-nums" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="hotel_email" className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email</Label>
                    <Input id="hotel_email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hospedaje@email.com" className="bg-background/50 h-9 rounded-md border-border/40 focus-visible:ring-primary/30 shadow-inner px-3 text-xs font-bold" />
                </div>
                <div className="sm:col-span-2 pt-2">
                    <div className="flex items-center justify-between p-4 bg-card/60 rounded-xl border border-border/40 shadow-sm transition-all hover:border-primary/30">
                        <div className="space-y-1">
                            <Label htmlFor="hotel_aplica_igv" className="text-sm font-extrabold text-foreground tracking-tight">El Hospedaje cobra IGV (18%)</Label>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Desactiva esto si tu hotel se encuentra en la Amazonía (zona exenta de IGV).</p>
                        </div>
                        <Switch 
                            id="hotel_aplica_igv"
                            checked={form.aplica_igv} 
                            onCheckedChange={(checked) => setForm({ ...form, aplica_igv: checked })} 
                            className="data-[state=checked]:bg-primary"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
