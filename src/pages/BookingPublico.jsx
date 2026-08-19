import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { CalendarDays, ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function invokeBooking(body) {
    const { data, error } = await supabase.functions.invoke('public-booking', { body });
    if (error) throw new Error('El motor de reservas seguro no está disponible. Contacta al hotel.');
    if (!data || data.error) throw new Error(data?.error || 'No se pudo completar la solicitud.');
    return data;
}

export default function BookingPublico() {
    const { hotelId } = useParams();
    const [dates, setDates] = useState({
        fecha_entrada: format(new Date(), 'yyyy-MM-dd'),
        fecha_salida: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    });
    const [guest, setGuest] = useState({ nombre: '', documento: '', telefono: '', email: '' });
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [completed, setCompleted] = useState(null);

    const context = useQuery({
        queryKey: ['public-booking-context', hotelId],
        queryFn: () => invokeBooking({ action: 'hotel', hotel_id: hotelId }),
        enabled: Boolean(hotelId),
        retry: false,
    });

    const search = useMutation({
        mutationFn: () => invokeBooking({ action: 'availability', hotel_id: hotelId, ...dates }),
        onSuccess: data => { setOptions(data.rooms || []); setSelected(null); },
    });

    const create = useMutation({
        mutationFn: () => invokeBooking({
            action: 'create',
            hotel_id: hotelId,
            habitacion_id: selected.id,
            fecha_entrada: dates.fecha_entrada,
            fecha_salida: dates.fecha_salida,
            huesped: guest,
        }),
        onSuccess: data => setCompleted(data.reservation || data),
    });

    if (!hotelId) return <PublicError message="El enlace de reserva es incompleto." />;
    if (context.isPending) return <PublicLoading />;
    if (context.isError) return <PublicError message={context.error.message} />;

    if (completed) {
        return (
            <main id="main-content" className="min-h-screen grid place-items-center bg-background p-6">
                <section className="max-w-lg rounded-3xl border bg-card p-8 text-center shadow-lg">
                    <h1 className="text-2xl font-black">Solicitud recibida</h1>
                    <p className="mt-3 text-sm text-muted-foreground">El hotel recibió tu solicitud de reserva.</p>
                    {completed.numero_reserva && <p className="mt-4 font-mono font-bold">Código: {completed.numero_reserva}</p>}
                </section>
            </main>
        );
    }

    return (
        <main id="main-content" className="min-h-screen bg-background p-4 py-10 text-foreground">
            <div className="mx-auto max-w-2xl space-y-6">
                <header className="text-center">
                    <p className="text-xs font-black uppercase tracking-widest text-primary">Reserva directa segura</p>
                    <h1 className="mt-2 text-3xl font-black">{context.data.hotel?.nombre || 'Hotel'}</h1>
                </header>

                <section aria-labelledby="dates-title" className="space-y-4 rounded-3xl border bg-card p-6">
                    <h2 id="dates-title" className="flex items-center gap-2 font-black"><CalendarDays className="h-5 w-5" /> Fechas de estadía</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="booking-in" label="Entrada"><Input id="booking-in" type="date" value={dates.fecha_entrada} onChange={e => setDates({ ...dates, fecha_entrada: e.target.value })} /></Field>
                        <Field id="booking-out" label="Salida"><Input id="booking-out" type="date" value={dates.fecha_salida} onChange={e => setDates({ ...dates, fecha_salida: e.target.value })} /></Field>
                    </div>
                    <Button className="w-full" disabled={search.isPending} onClick={() => search.mutate()}>Buscar disponibilidad</Button>
                    {search.isError && <InlineError message={search.error.message} />}
                </section>

                {options.length > 0 && (
                    <section aria-labelledby="rooms-title" className="space-y-3">
                        <h2 id="rooms-title" className="font-black">Opciones disponibles</h2>
                        {options.map(room => (
                            <button key={room.id} type="button" onClick={() => setSelected(room)} aria-pressed={selected?.id === room.id} className="flex w-full items-center justify-between rounded-2xl border bg-card p-5 text-left focus-visible:ring-2">
                                <span>
                                    <strong>{room.tipo || room.nombre}</strong>
                                    <small className="block text-muted-foreground mt-1">
                                        {formatDescripcion(room.descripcion)}
                                    </small>
                                </span>
                                <strong>S/ {Number(room.total || 0).toFixed(2)}</strong>
                            </button>
                        ))}
                    </section>
                )}

                {selected && (
                    <section aria-labelledby="guest-title" className="space-y-4 rounded-3xl border bg-card p-6">
                        <h2 id="guest-title" className="font-black">Datos del huésped</h2>
                        <Field id="guest-name" label="Nombre completo"><Input id="guest-name" autoComplete="name" value={guest.nombre} onChange={e => setGuest({ ...guest, nombre: e.target.value })} /></Field>
                        <Field id="guest-doc" label="Documento"><Input id="guest-doc" inputMode="numeric" value={guest.documento} onChange={e => setGuest({ ...guest, documento: e.target.value })} /></Field>
                        <Field id="guest-phone" label="Teléfono"><Input id="guest-phone" type="tel" autoComplete="tel" value={guest.telefono} onChange={e => setGuest({ ...guest, telefono: e.target.value })} /></Field>
                        <Field id="guest-email" label="Correo (opcional)"><Input id="guest-email" type="email" autoComplete="email" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} /></Field>
                        <Button className="w-full" disabled={create.isPending || !guest.nombre || !guest.documento || !guest.telefono} onClick={() => create.mutate()}>Solicitar reserva</Button>
                        {create.isError && <InlineError message={create.error.message} />}
                    </section>
                )}
            </div>
        </main>
    );
}

function Field({ id, label, children }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function InlineError({ message }) { return <p role="alert" className="text-sm font-semibold text-destructive">{message}</p>; }
function PublicLoading() { return <main id="main-content" className="min-h-screen grid place-items-center"><p role="status">Cargando enlace seguro…</p></main>; }
function PublicError({ message }) { return <main id="main-content" className="min-h-screen grid place-items-center p-6"><div role="alert" className="max-w-md rounded-2xl border border-destructive/30 bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h1 className="font-black">Servicio no disponible</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>; }

function formatDescripcion(desc) {
    if (!desc) return 'Habitación disponible';
    try {
        const obj = typeof desc === 'string' && desc.startsWith('{') ? JSON.parse(desc) : desc;
        if (typeof obj === 'object' && obj !== null) {
            const amenities = [];
            if (obj.wifi) amenities.push('WiFi');
            if (obj.tv) amenities.push('TV');
            if (obj.agua) amenities.push('Agua Caliente');
            if (obj.bano || obj.baño) amenities.push('Baño Privado');
            if (amenities.length > 0) return amenities.join(' • ');
            return 'Estándar';
        }
        return String(desc);
    } catch {
        return String(desc);
    }
}
