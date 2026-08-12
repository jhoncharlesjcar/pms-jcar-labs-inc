import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch.tsx';

export function HabitacionFormModal({ 
    open, setOpen, editId, form, setForm, amenities, setAmenities, 
    handleSave, isPending, tiposHab, estadoConfig, AMENITIES_MAP 
}) {
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md glass-panel border-border/80 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="font-display text-2xl">{editId ? 'Editar Habitación' : 'Nueva Habitación'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="numero">Número / Nombre</Label>
                            <Input id="numero" value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="101" className="mt-1 bg-background/50" />
                        </div>
                        <div>
                            <Label htmlFor="piso">Piso</Label>
                            <Input id="piso" value={form.piso} onChange={e => setForm({ ...form, piso: e.target.value })} placeholder="1" className="mt-1 bg-background/50" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="tipo">Tipo</Label>
                            <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                                <SelectTrigger id="tipo" className="mt-1 bg-background/50 text-base sm:text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {tiposHab.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="capacidad">Capacidad (personas)</Label>
                            <Input id="capacidad" type="number" min={1} value={String(form.capacidad)} onChange={e => setForm({ ...form, capacidad: Number(e.target.value) })} className="mt-1 bg-background/50" />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="precio">Precio base por noche (S/)</Label>
                        <Input id="precio" type="number" min={0} value={String(form.precio)} onChange={e => setForm({ ...form, precio: Number(e.target.value) })} placeholder="80" className="mt-1 bg-background/50" />
                    </div>
                    <div>
                        <Label htmlFor="estado">Estado</Label>
                        <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                            <SelectTrigger id="estado" className="mt-1 bg-background/50 text-base sm:text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {Object.entries(estadoConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="notas">Notas Rápidas</Label>
                        <Input 
                            id="notas"
                            value={form.notas || ''} 
                            onChange={e => setForm({ ...form, notas: e.target.value })} 
                            placeholder="Ej: Foco cambiado, toallas extras" 
                            className="mt-1 bg-background/50" 
                        />
                    </div>
                    <div>
                        <Label className="mb-2 block">Comodidades</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {AMENITIES_MAP.map(a => {
                                const Icon = a.icon;
                                return (
                                    <div key={a.id} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-xl p-2.5">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm font-medium">{a.label}</span>
                                        </div>
                                        <Switch checked={!!amenities[a.id]} onCheckedChange={c => setAmenities({ ...amenities, [a.id]: c })} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 bg-transparent border-border" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button className="flex-1" onClick={handleSave} disabled={isPending || !form.numero || !form.precio}>
                            {isPending ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
