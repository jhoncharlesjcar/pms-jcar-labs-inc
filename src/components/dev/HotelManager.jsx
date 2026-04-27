import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Plus, Building2, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const emptyHotel = {
    nombre: '', ruc: '', direccion: '', ciudad: '', telefono: '',
    email: '', hora_checkin: '14:00', hora_checkout: '12:00', activo: true, notas: ''
};

export default function HotelManager({ hoteles, habitaciones, reservas, ventas, usuarios, isLoading }) {
    const qc = useQueryClient();
    const [hotelModal, setHotelModal] = useState(false);
    const [editHotel, setEditHotel] = useState(null);
    const [hotelForm, setHotelForm] = useState(emptyHotel);
    const [error, setError] = useState(null);

    const saveHotel = useMutation({
        mutationFn: (data) => editHotel
            ? db.entities.Hotel.update(editHotel.id, data)
            : db.entities.Hotel.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            setHotelModal(false); setEditHotel(null); setHotelForm(emptyHotel);
            setError(null);
        },
        onError: (err) => {
            console.error("Save hotel error:", err);
            setError(err.message || "Error al guardar el hotel. Verifica tus permisos.");
        }
    });

    const deleteHotel = useMutation({
        mutationFn: (id) => db.entities.Hotel.delete(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const toggleHotel = useMutation({
        mutationFn: ({ id, activo }) => db.entities.Hotel.update(id, { activo }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['hoteles'] }),
    });

    const openCreate = () => { setEditHotel(null); setHotelForm(emptyHotel); setError(null); setHotelModal(true); };
    const openEdit = (h) => { setEditHotel(h); setHotelForm({ ...h }); setError(null); setHotelModal(true); };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-semibold text-foreground">Propiedades Multi-Tenant</p>
                    <p className="text-xs text-muted-foreground">Cada hotel opera de forma independiente con sus propios datos</p>
                </div>
                <Button onClick={openCreate} className="gap-2 bg-amber-500 hover:bg-amber-600" size="sm">
                    <Plus className="w-4 h-4" /> Nuevo Hotel
                </Button>
            </div>

            <div className="grid gap-4">
                {hoteles.map(h => {
                    const habsHotel = habitaciones.filter(hab => hab.hotel_id === h.id);
                    const reservasHotel = reservas.filter(r => r.hotel_id === h.id);
                    const ventasHotel = ventas.filter(v => v.hotel_id === h.id);
                    const staffHotel = usuarios.filter(u => u.hotel_id === h.id);

                    return (
                        <div key={h.id} className={cn(
                            "bg-card border-2 rounded-2xl p-5 transition-all",
                            h.activo ? "border-border hover:border-amber-200" : "border-dashed border-border opacity-60"
                        )}>
                            <div className="flex items-start gap-4">
                                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                                    h.activo ? "bg-amber-50" : "bg-secondary")}>
                                    <Building2 className={cn("w-6 h-6", h.activo ? "text-amber-600" : "text-muted-foreground")} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-bold text-foreground">{h.nombre}</p>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border",
                                            h.activo ? "bg-green-50 text-green-700 border-green-200" : "bg-secondary text-muted-foreground border-border")}>
                                            {h.activo ? '● Activo' : '○ Inactivo'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {[h.ciudad, h.direccion].filter(Boolean).join(' · ')}
                                    </p>
                                    <div className="flex gap-4 mt-3">
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-foreground">{habsHotel.length}</p>
                                            <p className="text-[10px] text-muted-foreground">Habitaciones</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-foreground">{reservasHotel.filter(r => r.estado === 'activa').length}</p>
                                            <p className="text-[10px] text-muted-foreground">Reservas activas</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-foreground">S/ {ventasHotel.reduce((s, v) => s + (v.total || 0), 0).toFixed(0)}</p>
                                            <p className="text-[10px] text-muted-foreground">Ingresos</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-foreground">{staffHotel.length}</p>
                                            <p className="text-[10px] text-muted-foreground">Staff</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 flex-shrink-0">
                                    <button onClick={() => toggleHotel.mutate({ id: h.id, activo: !h.activo })}
                                        className="p-2 rounded-lg hover:bg-secondary transition-colors" title={h.activo ? 'Desactivar' : 'Activar'}>
                                        {h.activo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => openEdit(h)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button onClick={() => { if (confirm(`¿Eliminar "${h.nombre}"?`)) deleteHotel.mutate(h.id); }}
                                        className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {hoteles.length === 0 && !isLoading && (
                    <div className="text-center py-16 border-2 border-dashed border-border rounded-2xl text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Sin hoteles registrados</p>
                        <Button onClick={openCreate} className="mt-4 gap-2" variant="outline"><Plus className="w-4 h-4" /> Crear primer hotel</Button>
                    </div>
                )}
            </div>

            <Dialog open={hotelModal} onOpenChange={setHotelModal}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editHotel ? 'Editar Hotel' : 'Nuevo Hotel'}</DialogTitle>
                        <DialogDescription>Ingresa los datos principales de la propiedad.</DialogDescription>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Label>Nombre del hotel *</Label><Input className="mt-1" value={hotelForm.nombre} onChange={e => setHotelForm({ ...hotelForm, nombre: e.target.value })} /></div>
                        <div><Label>RUC</Label><Input className="mt-1" value={hotelForm.ruc} onChange={e => setHotelForm({ ...hotelForm, ruc: e.target.value })} /></div>
                        <div><Label>Ciudad</Label><Input className="mt-1" value={hotelForm.ciudad} onChange={e => setHotelForm({ ...hotelForm, ciudad: e.target.value })} /></div>
                        <div className="col-span-2"><Label>Dirección</Label><Input className="mt-1" value={hotelForm.direccion} onChange={e => setHotelForm({ ...hotelForm, direccion: e.target.value })} /></div>
                        <div><Label>Teléfono</Label><Input className="mt-1" value={hotelForm.telefono} onChange={e => setHotelForm({ ...hotelForm, telefono: e.target.value })} /></div>
                        <div><Label>Email</Label><Input className="mt-1" type="email" value={hotelForm.email} onChange={e => setHotelForm({ ...hotelForm, email: e.target.value })} /></div>
                        <div><Label>Hora Check-in</Label><Input className="mt-1" type="time" value={hotelForm.hora_checkin} onChange={e => setHotelForm({ ...hotelForm, hora_checkin: e.target.value })} /></div>
                        <div><Label>Hora Check-out</Label><Input className="mt-1" type="time" value={hotelForm.hora_checkout} onChange={e => setHotelForm({ ...hotelForm, hora_checkout: e.target.value })} /></div>
                        <div className="col-span-2"><Label>Notas internas</Label><Input className="mt-1" value={hotelForm.notas} onChange={e => setHotelForm({ ...hotelForm, notas: e.target.value })} /></div>
                        <div className="col-span-2 flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setHotelModal(false)}>Cancelar</Button>
                            <Button className="flex-1 bg-amber-500 hover:bg-amber-600" disabled={saveHotel.isPending || !hotelForm.nombre} onClick={() => saveHotel.mutate(hotelForm)}>
                                {saveHotel.isPending ? 'Guardando...' : editHotel ? 'Actualizar Hotel' : 'Crear Hotel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
