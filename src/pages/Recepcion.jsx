import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Plus, Search, CalendarDays, User, BedDouble, CheckCircle, XCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, differenceInDays } from 'date-fns';
import RegistrarVentaModal from '@/components/RegistrarVentaModal';
import { useHotelData } from '@/hooks/use-hotel-data';

const estadoBadge = {
    pendiente: 'bg-orange-100 text-orange-700',
    activa: 'bg-primary/10 text-primary',
    finalizada: 'bg-green-100 text-green-700',
    cancelada: 'bg-red-100 text-red-700',
};

const emptyForm = {
    habitacion_id: '', habitacion_numero: '', habitacion_tipo: '',
    huesped_nombre: '', huesped_dni: '', huesped_telefono: '', huesped_procedencia: '',
    fecha_entrada: new Date().toISOString().split('T')[0],
    fecha_salida: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    noches: 1, precio_noche: 0, total: 0,
    num_adultos: 1, num_ninos: 0, observaciones: '', estado: 'activa',
};

export default function Recepcion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [open, setOpen] = useState(false);
    const [ventaModal, setVentaModal] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState('activa');

    const { data: reservas = [] } = useQuery({
        queryKey: ['reservas', hotelId],
        queryFn: () => hotelDb.Reserva.list(),
        enabled: !!hotelId,
    });

    const { data: habitaciones = [] } = useQuery({
        queryKey: ['habitaciones', hotelId],
        queryFn: () => hotelDb.Habitacion.list(),
        enabled: !!hotelId,
    });

    const saveReserva = useMutation({
        /** @param {any} data */
        mutationFn: async (data) => {
            const nueva = await hotelDb.Reserva.create({
                ...data,
                numero_reserva: `R${Date.now().toString().slice(-6)}`,
            });
            
            // Marcar habitación como ocupada/reservada (AWAITED PROFESSIONAL FIX)
            if (nueva.habitacion_id) {
                await hotelDb.Habitacion.update(nueva.habitacion_id, {
                    estado: nueva.estado === 'activa' ? 'ocupada' : 'reservada'
                });
            }
            return nueva;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['reservas'] });
            qc.invalidateQueries({ queryKey: ['habitaciones'] });
            setOpen(false);
            setForm(emptyForm);
        },
    });

    const actualizarEstado = useMutation({
        /** @param {any} params */
        mutationFn: ({ id, estado, hab_id }) => {
            const updates = [hotelDb.Reserva.update(id, { estado })];
            if (hab_id && estado === 'finalizada') {
                updates.push(hotelDb.Habitacion.update(hab_id, { estado: 'disponible' }));
            }
            return Promise.all(updates);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservas'] }); qc.invalidateQueries({ queryKey: ['habitaciones'] }); },
    });

    const seleccionarHab = (hab) => {
        const noches = differenceInDays(new Date(form.fecha_salida), new Date(form.fecha_entrada)) || 1;
        setForm({
            ...form,
            habitacion_id: hab.id,
            habitacion_numero: hab.numero,
            habitacion_tipo: hab.tipo,
            precio_noche: hab.precio_noche,
            noches,
            total: hab.precio_noche * noches,
        });
    };

    const calcTotal = (fe, fs, precio) => {
        const n = differenceInDays(new Date(fs), new Date(fe)) || 1;
        return { noches: n, total: precio * n };
    };

    const habitacionesDisp = habitaciones.filter(h => h.estado === 'disponible');

    const filtradas = reservas.filter(r => {
        const matchFiltro = filtro === 'todas' || r.estado === filtro;
        const matchBusqueda = !busqueda || r.huesped_nombre?.toLowerCase().includes(busqueda.toLowerCase()) || r.numero_reserva?.includes(busqueda) || r.habitacion_numero?.includes(busqueda);
        return matchFiltro && matchBusqueda;
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-display text-3xl font-bold text-foreground">Recepción</h1>
                    <p className="text-muted-foreground mt-1">Gestión de reservas y check-in/out</p>
                </div>
                <Button onClick={() => setOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Nueva Reserva
                </Button>
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar huésped, habitación..." className="pl-9" />
                </div>
                <div className="flex gap-2">
                    {['todas', 'pendiente', 'activa', 'finalizada', 'cancelada'].map(f => (
                        <button key={f} onClick={() => setFiltro(f)} className={cn(
                            "px-3 py-2 rounded-xl text-xs font-medium border transition-all",
                            filtro === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-secondary"
                        )}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Lista reservas */}
            <div className="space-y-3">
                {filtradas.map(r => (
                    <div key={r.id} className="bg-card rounded-2xl border border-border p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <User className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold text-foreground">{r.huesped_nombre}</p>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", estadoBadge[r.estado])}>
                                            {r.estado}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        Hab. {r.habitacion_numero} ({r.habitacion_tipo}) · {r.noches} noche(s)
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {r.fecha_entrada} → {r.fecha_salida} · DNI: {r.huesped_dni || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <p className="font-bold text-foreground">S/ {r.total?.toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground">{r.numero_reserva}</p>
                                </div>
                                <div className="flex gap-2">
                                    {r.estado === 'activa' && (
                                        <>
                                            <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 gap-1"
                                                onClick={() => setVentaModal(r)}>
                                                <CheckCircle className="w-3 h-3" /> Check-out / Cobrar
                                            </Button>
                                        </>
                                    )}
                                    {r.estado === 'pendiente' && (
                                        <Button size="sm" variant="outline" className="text-primary border-primary/30 gap-1"
                                            onClick={() => actualizarEstado.mutate({ id: r.id, estado: 'activa', hab_id: r.habitacion_id })}>
                                            <LogIn className="w-3 h-3" /> Check-in
                                        </Button>
                                    )}
                                    {(r.estado === 'pendiente' || r.estado === 'activa') && (
                                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50"
                                            onClick={() => { if (confirm('¿Cancelar reserva?')) actualizarEstado.mutate({ id: r.id, estado: 'cancelada', hab_id: r.habitacion_id }); }}>
                                            <XCircle className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filtradas.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay reservas {filtro !== 'todas' ? `con estado "${filtro}"` : ''}</p>
                    </div>
                )}
            </div>

            {/* Modal nueva reserva */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="font-display">Nueva Reserva / Check-in</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {/* Selección habitación */}
                        <div>
                            <Label className="mb-2 block">Seleccionar Habitación Disponible</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {habitacionesDisp.map(h => (
                                    <button key={h.id} onClick={() => seleccionarHab(h)}
                                        className={cn(
                                            "p-3 rounded-xl border-2 text-left transition-all",
                                            form.habitacion_id === h.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                                        )}>
                                        <p className="font-bold text-sm">#{h.numero}</p>
                                        <p className="text-xs text-muted-foreground capitalize">{h.tipo}</p>
                                        <p className="text-xs font-medium text-foreground">S/{h.precio_noche}</p>
                                    </button>
                                ))}
                                {habitacionesDisp.length === 0 && <p className="col-span-3 text-sm text-muted-foreground">Sin habitaciones disponibles</p>}
                            </div>
                        </div>

                        {/* Datos huésped */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <Label>Nombre completo del huésped</Label>
                                <Input value={form.huesped_nombre} onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} placeholder="Juan Pérez García" className="mt-1" />
                            </div>
                            <div>
                                <Label>DNI / Pasaporte</Label>
                                <Input value={form.huesped_dni} onChange={e => setForm({ ...form, huesped_dni: e.target.value })} placeholder="12345678" className="mt-1" />
                            </div>
                            <div>
                                <Label>Teléfono</Label>
                                <Input value={form.huesped_telefono} onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} placeholder="999 888 777" className="mt-1" />
                            </div>
                            <div>
                                <Label>Procedencia</Label>
                                <Input value={form.huesped_procedencia} onChange={e => setForm({ ...form, huesped_procedencia: e.target.value })} placeholder="Lima, Cusco..." className="mt-1" />
                            </div>
                            <div>
                                <Label>N° Adultos</Label>
                                <Input type="number" min={1} value={form.num_adultos} onChange={e => setForm({ ...form, num_adultos: Number(e.target.value) })} className="mt-1" />
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Fecha entrada</Label>
                                <Input type="date" value={form.fecha_entrada} onChange={e => {
                                    const { noches, total } = calcTotal(e.target.value, form.fecha_salida, form.precio_noche);
                                    setForm({ ...form, fecha_entrada: e.target.value, noches, total });
                                }} className="mt-1" />
                            </div>
                            <div>
                                <Label>Fecha salida</Label>
                                <Input type="date" value={form.fecha_salida} onChange={e => {
                                    const { noches, total } = calcTotal(form.fecha_entrada, e.target.value, form.precio_noche);
                                    setForm({ ...form, fecha_salida: e.target.value, noches, total });
                                }} className="mt-1" />
                            </div>
                        </div>

                        {form.habitacion_id && (
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Hab. #{form.habitacion_numero} × {form.noches} noche(s)</span>
                                    <span className="font-bold text-foreground">S/ {form.total.toFixed(2)}</span>
                                </div>
                            </div>
                        )}

                        <div>
                            <Label>Estado inicial</Label>
                            <Select value={form.estado} onValueChange={v => setForm({ ...form, estado: v })}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendiente">Reserva (Check-in pendiente)</SelectItem>
                                    <SelectItem value="activa">Check-in directo (Activa)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label>Observaciones</Label>
                            <Input value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Notas adicionales..." className="mt-1" />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button className="flex-1" onClick={() => saveReserva.mutate(form)}
                                disabled={saveReserva.isPending || !form.habitacion_id || !form.huesped_nombre}>
                                {saveReserva.isPending ? 'Guardando...' : 'Registrar'}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Modal cobro */}
            {ventaModal && (
                <RegistrarVentaModal
                    reserva={ventaModal}
                    onClose={() => setVentaModal(null)}
                    onSuccess={() => {
                        actualizarEstado.mutate({ id: ventaModal.id, estado: 'finalizada', hab_id: ventaModal.habitacion_id });
                        setVentaModal(null);
                    }}
                />
            )}
        </div>
    );
}