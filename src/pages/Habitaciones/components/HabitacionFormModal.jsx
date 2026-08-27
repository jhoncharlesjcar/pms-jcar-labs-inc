import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AMENITIES_MAP } from '../utils/amenities';
import { TIPOS_HABITACION } from '@/services/habitaciones.service';

export function HabitacionFormModal({ 
    open, setOpen, 
    form, setForm, 
    amenities, setAmenities, 
    editId, estadoConfig, 
    handleSave, isPending 
}) {
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent className="sm:max-w-md bg-card border-l border-border shadow-xl overflow-y-auto">
                <SheetHeader className="mb-4">
                    <SheetTitle className="text-xl font-bold">{editId ? 'Editar Habitación' : 'Nueva Habitación'}</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Número / Nombre</Label>
                            <Input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="101" className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                        </div>
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Piso</Label>
                            <Input value={form.piso} onChange={e => setForm({ ...form, piso: e.target.value })} placeholder="1" className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo</Label>
                            <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                                <SelectTrigger className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-md">
                                    {TIPOS_HABITACION.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capacidad (pers.)</Label>
                            <Input type="number" min={1} value={String(form.capacidad)} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Precio por noche (S/)</Label>
                        <Input type="number" min={0} value={String(form.precio_noche ?? form.precio ?? 0)} onChange={e => setForm({ ...form, precio_noche: Number(e.target.value), precio: Number(e.target.value) })} placeholder="80" className="mt-1 h-9 bg-background text-sm font-semibold rounded-md border border-input focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estado</Label>
                        <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                            <SelectTrigger className="mt-1 h-9 bg-background text-sm font-medium rounded-md border border-input focus:ring-1 focus:ring-primary"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-md">
                                {Object.entries(estadoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">URL de Foto (Opcional)</Label>
                        <Input value={form.imagen_url || ''} onChange={e => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://ejemplo.com/foto.jpg" className="mt-1 h-9 bg-background text-sm rounded-md border border-input focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Comodidades (Amenities)</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {AMENITIES_MAP.map(a => {
                                const Icon = a.icon;
                                return (
                                    <div key={a.id} className="flex items-center justify-between bg-muted/20 border border-border rounded-lg p-2 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-1.5">
                                            <Icon className="w-3.5 h-3.5 text-primary" />
                                            <span className="text-xs font-medium">{a.label}</span>
                                        </div>
                                        <Switch 
                                            checked={!!amenities[a.id]} 
                                            onCheckedChange={c => setAmenities({ ...amenities, [a.id]: c })} 
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-4 mt-4 border-t border-border/40">
                        <Button variant="outline" className="flex-1 bg-transparent" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button className="flex-1" onClick={handleSave} disabled={isPending || !form.numero}>
                            {isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
