import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { CalendarDays, ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ChatBubble from '@/components/ai/ChatBubble';
import { validarDocumento } from '@/services/recepcion.service';

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
    const [guest, setGuest] = useState({ 
        tipo_reserva: 'particular', 
        nombre: '', 
        documento: '', 
        tipo_documento: 'DNI',
        telefono: '', 
        email: '' 
    });
    const [options, setOptions] = useState([]);
    const [selected, setSelected] = useState(null);
    const [completed, setCompleted] = useState(null);
    const [challengeToken, setChallengeToken] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('yape');
    const turnstileRef = useRef(null);
    const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
    const sessionId = useMemo(() => {
        const key = `jcar_booking_session:${hotelId}`;
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const generated = crypto.randomUUID();
        sessionStorage.setItem(key, generated);
        return generated;
    }, [hotelId]);
    const idempotencyKey = useMemo(() => {
        const key = `jcar_booking_idempotency:${hotelId}`;
        const existing = sessionStorage.getItem(key);
        if (existing) return existing;
        const generated = crypto.randomUUID();
        sessionStorage.setItem(key, generated);
        return generated;
    }, [hotelId]);

    useEffect(() => {
        if (!turnstileSiteKey || !turnstileRef.current) return undefined;
        let widgetId;
        const render = () => {
            const turnstile = /** @type {any} */ (window).turnstile;
            if (!turnstile || !turnstileRef.current || widgetId !== undefined) return;
            widgetId = turnstile.render(turnstileRef.current, {
                sitekey: turnstileSiteKey,
                callback: setChallengeToken,
                'expired-callback': () => setChallengeToken(''),
                'error-callback': () => setChallengeToken(''),
            });
        };
        const existing = document.querySelector('script[data-jcar-turnstile]');
        if (existing) render();
        else {
            const script = document.createElement('script');
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.defer = true;
            script.dataset.jcarTurnstile = 'true';
            script.addEventListener('load', render);
            document.head.appendChild(script);
        }
        const timer = window.setInterval(render, 250);
        return () => {
            window.clearInterval(timer);
            const turnstile = /** @type {any} */ (window).turnstile;
            if (widgetId !== undefined && turnstile) turnstile.remove(widgetId);
        };
    }, [turnstileSiteKey, selected]);

    const updateDates = (field, value) => {
        setDates(current => ({ ...current, [field]: value }));
        setOptions([]);
        setSelected(null);
        search.reset();
        create.reset();
    };

    const context = useQuery({
        queryKey: ['public-booking-context', hotelId],
        queryFn: () => invokeBooking({ action: 'hotel', hotel_id: hotelId }),
        enabled: Boolean(hotelId),
        retry: false,
    });

    const search = useMutation({
        mutationFn: () => {
            if (!dates.fecha_entrada || !dates.fecha_salida || dates.fecha_salida <= dates.fecha_entrada) {
                throw new Error('La salida debe ser posterior a la entrada.');
            }
            return invokeBooking({ action: 'availability', hotel_id: hotelId, ...dates, adultos: 1, ninos: 0 });
        },
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
            adultos: 1,
            ninos: 0,
            session_id: sessionId,
            idempotency_key: idempotencyKey,
            challenge_token: challengeToken,
            payment_method: paymentMethod,
        }),
        onSuccess: data => {
            sessionStorage.removeItem(`jcar_booking_idempotency:${hotelId}`);
            setCompleted(data);
        },
        onError: () => {
            setChallengeToken('');
            /** @type {any} */ (window).turnstile?.reset();
        },
    });

    const documentValidation = validarDocumento({ tipo: /** @type {import('@/services/recepcion.service').TipoDocumento} */ (guest.tipo_documento), documento: guest.documento });

    if (!hotelId) return <PublicError message="El enlace de reserva es incompleto." />;
    if (!turnstileSiteKey) return <PublicError message="Las reservas en línea están temporalmente deshabilitadas. Contacta directamente al hotel." />;
    if (context.isPending) return <PublicLoading />;
    if (context.isError) return <PublicError message={context.error.message} />;

    if (completed) {
        const reservation = completed.reservation || null;
        const payment = completed.payment || completed.payment_intent || null;
        const hold = completed.hold || null;
        return (
            <main id="main-content" className="min-h-screen grid place-items-center bg-background p-6">
                <section className="max-w-lg rounded-3xl border bg-card p-8 text-center shadow-lg">
                    <h1 className="text-2xl font-black">Reserva pendiente de pago</h1>
                    <p className="mt-3 text-sm text-muted-foreground">Guardamos temporalmente la habitación. Completa el pago antes del vencimiento para confirmarla.</p>
                    {(reservation?.numero_reserva || completed.numero_reserva) && <p className="mt-4 font-mono font-bold text-lg">Código: {reservation?.numero_reserva || completed.numero_reserva}</p>}
                    {payment && <div className="mt-6 rounded-2xl border bg-muted/40 p-5 text-left"><p className="font-bold">Monto: {payment.currency || 'PEN'} {Number(payment.amount || payment.amount_due || 0).toFixed(2)}</p>{payment.instructions && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{payment.instructions}</p>}</div>}
                    {hold?.expires_at && <p className="mt-3 text-xs text-muted-foreground">El bloqueo vence: {new Date(hold.expires_at).toLocaleString('es-PE')}</p>}
                    
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
                        <Field id="booking-in" label="Entrada"><Input id="booking-in" type="date" min={format(new Date(), 'yyyy-MM-dd')} value={dates.fecha_entrada} onChange={e => updateDates('fecha_entrada', e.target.value)} /></Field>
                        <Field id="booking-out" label="Salida"><Input id="booking-out" type="date" min={dates.fecha_entrada} value={dates.fecha_salida} onChange={e => updateDates('fecha_salida', e.target.value)} /></Field>
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
                        
                        <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2">
                                <input type="radio" name="tipo_reserva" checked={guest.tipo_reserva === 'particular'} onChange={() => setGuest({ ...guest, tipo_reserva: 'particular', tipo_documento: 'DNI', nombre: '', documento: '' })} className="accent-primary" />
                                Particular
                            </label>
                            <label className="flex items-center gap-2">
                                <input type="radio" name="tipo_reserva" checked={guest.tipo_reserva === 'corporativa'} onChange={() => setGuest({ ...guest, tipo_reserva: 'corporativa', tipo_documento: 'RUC', nombre: '', documento: '' })} className="accent-primary" />
                                Corporativa (Empresa)
                            </label>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 items-end">
                            <Field id="guest-doc-type" label="Tipo de documento">
                                <select id="guest-doc-type" value={guest.tipo_documento} disabled={guest.tipo_reserva === 'corporativa'} onChange={e => setGuest({ ...guest, tipo_documento: e.target.value, documento: '' })} className="flex h-10 w-full rounded-md border bg-background px-3">
                                    {guest.tipo_reserva === 'corporativa' ? <option value="RUC">RUC</option> : <><option value="DNI">DNI</option><option value="CE">Carnet de extranjería</option><option value="pasaporte">Pasaporte</option></>}
                                </select>
                            </Field>
                            <Field id="guest-doc" label="Número de documento">
                                <div className="flex gap-2">
                                    <Input id="guest-doc" inputMode={['DNI', 'RUC'].includes(guest.tipo_documento) ? 'numeric' : 'text'} value={guest.documento} onChange={e => setGuest({ ...guest, documento: e.target.value })} placeholder="Ingresa el documento" />
                                </div>
                            </Field>
                            <Field id="guest-name" label={guest.tipo_reserva === 'corporativa' ? 'Razón Social' : 'Nombre completo'}>
                                <Input id="guest-name" autoComplete="name" value={guest.nombre} onChange={e => setGuest({ ...guest, nombre: e.target.value })} />
                            </Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="guest-phone" label="Teléfono"><Input id="guest-phone" type="tel" autoComplete="tel" value={guest.telefono} onChange={e => setGuest({ ...guest, telefono: e.target.value })} /></Field>
                            <Field id="guest-email" label="Correo (opcional)"><Input id="guest-email" type="email" autoComplete="email" value={guest.email} onChange={e => setGuest({ ...guest, email: e.target.value })} /></Field>
                        </div>
                        <Field id="payment-method" label="Método de pago">
                            <select id="payment-method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="flex h-10 w-full rounded-md border bg-background px-3">
                                <option value="yape">Yape</option><option value="plin">Plin</option><option value="transferencia">Transferencia bancaria</option>
                            </select>
                        </Field>
                        <div ref={turnstileRef} aria-label="Verificación de seguridad" />
                        {!documentValidation.valido && guest.documento && <InlineError message={documentValidation.error} />}
                        <Button className="w-full mt-4" disabled={create.isPending || !guest.nombre || !documentValidation.valido || !guest.telefono || !challengeToken} onClick={() => create.mutate()}>Crear reserva pendiente de pago</Button>
                        {create.isError && <InlineError message={create.error.message} />}
                    </section>
                )}
            </div>
            
            <ChatBubble hotelId={hotelId} />
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
