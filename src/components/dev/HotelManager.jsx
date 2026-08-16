import { useState, memo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import logger from '@/lib/logger';
import { db } from '@/api/db';
import { Plus, Building2, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const emptyHotel = {
    nombre: '', ruc: '', direccion: '', ciudad: '', telefono: '',
    email: '', hora_checkin: '14:00', hora_checkout: '12:00', activo: true, notas: ''
};

const toHotelForm = (hotel = {}) => ({
    ...emptyHotel,
    nombre: hotel.nombre || '',
    ruc: hotel.ruc || '',
    direccion: hotel.direccion || '',
    ciudad: hotel.ciudad || '',
    telefono: hotel.telefono || '',
    email: hotel.email || '',
    hora_checkin: hotel.hora_checkin || '14:00',
    hora_checkout: hotel.hora_checkout || '12:00',
    activo: hotel.activo !== false,
    notas: hotel.notas || '',
});

const hotelActionError = (err, fallback) => {
    const message = err?.message || '';
    if (message.includes("'activo' column") || (err?.code === 'PGRST204' && message.includes('activo'))) {
        return 'La base de datos necesita la migración que agrega el estado activo de los hoteles.';
    }
    return message || fallback;
};

/**
 * @type {React.FC<{ hoteles: any, habitaciones: any, reservas: any, ventas: any, usuarios: any, isLoading?: boolean }>}
 */
const HotelManager = memo(function HotelManager({ hoteles, habitaciones, reservas, ventas, usuarios, isLoading }) {
    const qc = useQueryClient();
    const [hotelModal, setHotelModal] = useState(false);
    const [editHotel, setEditHotel] = useState(null);
    const [hotelForm, setHotelForm] = useState(emptyHotel);
    const [error, setError] = useState(null);
    const [deleteCandidate, setDeleteCandidate] = useState(null);

    const saveHotel = useMutation({
        mutationFn: (/** @type {any} */ data) => editHotel
            ? db.entities.Hotel.update(editHotel.id, data)
            : db.entities.Hotel.create(data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            setHotelModal(false); setEditHotel(null); setHotelForm(emptyHotel);
            setError(null);
            toast.success(editHotel ? 'Hotel actualizado correctamente.' : 'Hotel creado correctamente.');
        },
        onError: (err) => {
            logger.error("Save hotel error:", err);
            const message = hotelActionError(err, 'Error al guardar el hotel. Verifica tus permisos.');
            setError(message);
            toast.error(message);
        }
    });

    const deleteHotel = useMutation({
        mutationFn: (/** @type {any} */ id) => db.entities.Hotel.delete(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            setDeleteCandidate(null);
            toast.success('Hotel eliminado correctamente.');
        },
        onError: (err) => {
            logger.error('Delete hotel error:', err);
            toast.error(err.message || 'No se pudo eliminar el hotel. Revisa si tiene datos relacionados.');
        },
    });

    const toggleHotel = useMutation({
        mutationFn: (/** @type {any} */ { id, activo }) => db.entities.Hotel.update(id, { activo }),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ['hoteles'] });
            toast.success(variables.activo ? 'Hotel activado.' : 'Hotel desactivado.');
        },
        onError: (err) => {
            logger.error('Toggle hotel error:', err);
            toast.error(hotelActionError(err, 'No se pudo cambiar el estado del hotel.'));
        },
    });

    const openCreate = () => { setEditHotel(null); setHotelForm(emptyHotel); setError(null); setHotelModal(true); };
    const openEdit = (h) => { setEditHotel(h); setHotelForm(toHotelForm(h)); setError(null); setHotelModal(true); };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-extrabold text-sm text-foreground tracking-tight">Propiedades Multi-Tenant</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mt-0.5">Cada hotel opera de forma independiente con sus propios datos</p>
                </div>
                <Button onClick={openCreate} className="gap-1.5 bg-amber-500 hover:bg-amber-600 h-9 px-3 text-[10px] uppercase tracking-widest font-extrabold rounded-md shadow-sm">
                    <Plus className="w-3.5 h-3.5" /> Nuevo Hotel
                </Button>
            </div>

            <div className="grid gap-4">
                {hoteles.map(h => {
                    const isActive = h.activo !== false;
                    const habsHotel = habitaciones.filter(hab => hab.hotel_id === h.id);
                    const reservasHotel = reservas.filter(r => r.hotel_id === h.id);
                    const ventasHotel = ventas.filter(v => v.hotel_id === h.id);
                    const staffHotel = usuarios.filter(u => u.hotel_id === h.id);

                    return (
                        <div key={h.id} className={cn(
                            "bg-card/60 backdrop-blur-sm border border-border/40 rounded-xl p-4 shadow-sm transition-[transform,opacity]",
                            isActive ? "hover:border-amber-500/30" : "border-dashed opacity-60"
                        )}>
                            <div className="flex items-start gap-4">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 shadow-xs border border-border/20",
                                    isActive ? "bg-amber-500/10" : "bg-secondary")}>
                                    <Building2 className={cn("w-5 h-5", isActive ? "text-amber-500" : "text-secondary-foreground")} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-extrabold tracking-tight text-sm text-foreground">{h.nombre}</p>
                                        <span className={cn("text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-widest font-black border",
                                            isActive ? "bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400" : "bg-secondary text-secondary-foreground border-border")}>
                                            {isActive ? '● Activo' : '○ Inactivo'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground mt-1">
                                        {[h.ciudad, h.direccion].filter(Boolean).join(' · ')}
                                    </p>
                                    <div className="flex gap-5 mt-3">
                                        <div className="text-center">
                                            <p className="text-xs font-extrabold tracking-tight text-foreground leading-none mb-0.5">{habsHotel.length}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Habitaciones</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-extrabold tracking-tight text-foreground leading-none mb-0.5">{reservasHotel.filter(r => r.estado === 'activa').length}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Reservas act.</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-extrabold tracking-tight text-foreground leading-none mb-0.5">S/ {ventasHotel.reduce((s, v) => s + Number(v.total || 0), 0).toFixed(0)}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ingresos</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-extrabold tracking-tight text-foreground leading-none mb-0.5">{staffHotel.length}</p>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Staff</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1 flex-shrink-0" aria-label={`Acciones de ${h.nombre}`}>
                                    <button type="button" onClick={() => toggleHotel.mutate({ id: h.id, activo: !isActive })}
                                        disabled={toggleHotel.isPending && toggleHotel.variables?.id === h.id}
                                        aria-label={isActive ? `Desactivar ${h.nombre}` : `Activar ${h.nombre}`}
                                        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary transition-colors disabled:cursor-wait disabled:opacity-50" title={isActive ? 'Desactivar hotel' : 'Activar hotel'}>
                                        {isActive ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                    </button>
                                    <button type="button" onClick={() => openEdit(h)} aria-label={`Editar ${h.nombre}`} title="Editar hotel" className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary transition-colors">
                                        <Pencil className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button type="button" onClick={() => setDeleteCandidate(h)} aria-label={`Eliminar ${h.nombre}`} title="Eliminar hotel"
                                        className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors">
                                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {hoteles.length === 0 && !isLoading && (
                    <div className="text-center py-10 border-2 border-dashed border-border/40 rounded-xl text-muted-foreground bg-card/20">
                        <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Sin hoteles registrados</p>
                        <Button onClick={openCreate} className="mt-3 gap-1.5 h-9 px-3 text-[9px] uppercase font-extrabold tracking-widest rounded-md" variant="outline"><Plus className="w-3 h-3" /> Crear primer hotel</Button>
                    </div>
                )}
            </div>

            <Dialog open={hotelModal} onOpenChange={setHotelModal}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5 rounded-xl border border-border/40 bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-extrabold tracking-tight">{editHotel ? 'Editar Hotel' : 'Nuevo Hotel'}</DialogTitle>
                        <DialogDescription className="text-[10px] font-bold">Ingresa los datos principales de la propiedad.</DialogDescription>
                    </DialogHeader>

                    {error && (
                        <Alert variant="destructive" className="mb-4 py-2 px-3 rounded-md">
                            <AlertDescription className="text-[10px] font-bold">{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2"><Label className="text-[9px] font-black uppercase tracking-widest">Nombre del hotel *</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.nombre} onChange={e => setHotelForm({ ...hotelForm, nombre: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">RUC</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.ruc} onChange={e => setHotelForm({ ...hotelForm, ruc: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">Ciudad</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.ciudad} onChange={e => setHotelForm({ ...hotelForm, ciudad: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="text-[9px] font-black uppercase tracking-widest">Dirección</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.direccion} onChange={e => setHotelForm({ ...hotelForm, direccion: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">Teléfono</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.telefono} onChange={e => setHotelForm({ ...hotelForm, telefono: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">Email</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" type="email" value={hotelForm.email} onChange={e => setHotelForm({ ...hotelForm, email: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">Hora Check-in</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" type="time" value={hotelForm.hora_checkin} onChange={e => setHotelForm({ ...hotelForm, hora_checkin: e.target.value })} /></div>
                        <div><Label className="text-[9px] font-black uppercase tracking-widest">Hora Check-out</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" type="time" value={hotelForm.hora_checkout} onChange={e => setHotelForm({ ...hotelForm, hora_checkout: e.target.value })} /></div>
                        <div className="col-span-2"><Label className="text-[9px] font-black uppercase tracking-widest">Notas internas</Label><Input className="h-9 px-3 text-xs rounded-md font-bold mt-1 shadow-inner border-border/40 bg-background/50" value={hotelForm.notas} onChange={e => setHotelForm({ ...hotelForm, notas: e.target.value })} /></div>
                        <div className="col-span-2 flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 h-9 rounded-md text-[10px] font-extrabold uppercase tracking-widest shadow-sm" onClick={() => setHotelModal(false)}>Cancelar</Button>
                            <Button className="flex-1 bg-amber-500 hover:bg-amber-600 h-9 rounded-md text-[10px] font-extrabold uppercase tracking-widest shadow-sm" disabled={saveHotel.isPending || !hotelForm.nombre} onClick={() => saveHotel.mutate(hotelForm)}>
                                {saveHotel.isPending ? 'Guardando...' : editHotel ? 'Actualizar Hotel' : 'Crear Hotel'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteCandidate}
                onOpenChange={(open) => { if (!open) setDeleteCandidate(null); }}
                title="Eliminar hotel permanentemente"
                description={deleteCandidate ? `Se eliminará “${deleteCandidate.nombre}” y los datos asociados que tengan eliminación en cascada. Esta acción no se puede deshacer.` : ''}
                confirmText="Eliminar hotel"
                variant="destructive"
                isPending={deleteHotel.isPending}
                onConfirm={() => deleteCandidate && deleteHotel.mutate(deleteCandidate.id)}
            />
        </div>
    );
});
HotelManager.displayName = 'HotelManager';
export default HotelManager;
