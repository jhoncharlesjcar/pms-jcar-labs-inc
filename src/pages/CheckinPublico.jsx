import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validarDocumento } from '@/services/recepcion.service';

async function invokeCheckin(body) {
    const { data, error } = await supabase.functions.invoke('public-checkin', { body });
    if (error) throw new Error('El pre check-in seguro no está disponible. Completa el registro en recepción.');
    if (!data || data.error) throw new Error(data?.error || 'El enlace es inválido o expiró.');
    return data;
}

export default function CheckinPublico() {
    const { token } = useParams();
    const [form, setForm] = useState({ 
        huesped_nombre: '', tipo_documento: 'DNI', huesped_dni: '', huesped_telefono: '', huesped_email: '', 
        huesped_fecha_nacimiento: '', nacionalidad: 'Peruano', huesped_estado_civil: 'Soltero', huesped_profesion: '', motivo_viaje: 'Turismo'
    });
    const [done, setDone] = useState(false);
    
    const context = useQuery({ 
        queryKey: ['public-checkin-context', token], 
        queryFn: async () => {
            const res = await invokeCheckin({ action: 'load', token });
            if (res.reservation) {
                setForm(prev => ({
                    ...prev,
                    huesped_nombre: res.reservation.huesped_nombre || '',
                    huesped_dni: res.reservation.huesped_dni || '',
                    huesped_telefono: res.reservation.huesped_telefono || '',
                    huesped_email: res.reservation.huesped_email || '',
                    tipo_documento: res.reservation.tipo_documento || 'DNI'
                }));
            }
            return res;
        },
        enabled: Boolean(token), 
        retry: false 
    });
    
    const submit = useMutation({
        mutationFn: () => {
            const validation = validarDocumento({ tipo: /** @type {any} */ (form.tipo_documento), documento: form.huesped_dni });
            if (!validation.valido) throw new Error(validation.error);
            return invokeCheckin({ action: 'submit', token, payload: form });
        },
        onSuccess: () => setDone(true),
    });

    if (!token || context.isError) return <CheckinError message={context.error?.message || 'El enlace es incompleto.'} />;
    if (context.isPending) return <main id="main-content" className="min-h-screen grid place-items-center"><p role="status">Validando enlace…</p></main>;
    if (done) return <main id="main-content" className="min-h-screen grid place-items-center p-6"><section className="max-w-md rounded-3xl border bg-card p-8 text-center"><h1 className="text-2xl font-black">Registro enviado</h1><p className="mt-3 text-sm text-muted-foreground">Recepción validará tus datos y documentos al llegar.</p></section></main>;

    return (
        <main id="main-content" className="min-h-screen bg-background p-5 py-10">
            <form className="mx-auto max-w-xl space-y-5 rounded-3xl border bg-card p-6" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
                <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Pre check-in seguro</p><h1 className="mt-1 text-2xl font-black">{context.data.hotel?.nombre || 'Hotel'}</h1></header>
                
                {form.tipo_documento === 'RUC' ? (
                    <div className="p-4 bg-muted/50 rounded-xl mb-4 border">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Reserva Corporativa</p>
                        <p className="font-bold">{form.huesped_nombre}</p>
                        <p className="text-sm">RUC: {form.huesped_dni}</p>
                        <p className="text-sm mt-2 text-muted-foreground">Por favor, completa los datos de contacto para la estadía.</p>
                    </div>
                ) : (
                    <>
                        <Field id="checkin-name" label="Nombre completo"><Input id="checkin-name" required autoComplete="name" value={form.huesped_nombre} onChange={e => setForm({ ...form, huesped_nombre: e.target.value })} /></Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="checkin-doc-type" label="Tipo de documento"><select id="checkin-doc-type" className="flex h-10 w-full rounded-md border bg-background px-3" value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value, huesped_dni: '' })}><option value="DNI">DNI</option><option value="pasaporte">Pasaporte</option><option value="CE">CE</option></select></Field>
                            <Field id="checkin-doc" label="Número de documento"><Input id="checkin-doc" required inputMode={form.tipo_documento === 'DNI' ? 'numeric' : 'text'} value={form.huesped_dni} onChange={e => setForm({ ...form, huesped_dni: e.target.value })} /></Field>
                        </div>
                    </>
                )}
                
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="checkin-phone" label="Teléfono"><Input id="checkin-phone" required type="tel" autoComplete="tel" value={form.huesped_telefono} onChange={e => setForm({ ...form, huesped_telefono: e.target.value })} /></Field>
                    <Field id="checkin-email" label="Correo"><Input id="checkin-email" type="email" autoComplete="email" value={form.huesped_email} onChange={e => setForm({ ...form, huesped_email: e.target.value })} /></Field>
                </div>

                {form.tipo_documento !== 'RUC' && (
                    <div className="pt-4 border-t mt-4 space-y-4">
                        <h3 className="font-bold text-sm uppercase text-muted-foreground">Datos Requeridos por Migraciones</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="checkin-nac" label="Nacionalidad"><Input id="checkin-nac" value={form.nacionalidad} onChange={e => setForm({ ...form, nacionalidad: e.target.value })} /></Field>
                            <Field id="checkin-fnac" label="Fecha de nacimiento"><Input id="checkin-fnac" type="date" required value={form.huesped_fecha_nacimiento} onChange={e => setForm({ ...form, huesped_fecha_nacimiento: e.target.value })} /></Field>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Field id="checkin-ec" label="Estado Civil">
                                <select id="checkin-ec" className="flex h-10 w-full rounded-md border bg-background px-3" value={form.huesped_estado_civil} onChange={e => setForm({ ...form, huesped_estado_civil: e.target.value })}>
                                    <option>Soltero/a</option><option>Casado/a</option><option>Divorciado/a</option><option>Viudo/a</option>
                                </select>
                            </Field>
                            <Field id="checkin-prof" label="Profesión"><Input id="checkin-prof" required value={form.huesped_profesion} onChange={e => setForm({ ...form, huesped_profesion: e.target.value })} /></Field>
                            <Field id="checkin-mot" label="Motivo de Viaje">
                                <select id="checkin-mot" className="flex h-10 w-full rounded-md border bg-background px-3" value={form.motivo_viaje} onChange={e => setForm({ ...form, motivo_viaje: e.target.value })}>
                                    <option>Turismo</option><option>Negocios</option><option>Salud</option><option>Visita familiar</option>
                                </select>
                            </Field>
                        </div>
                    </div>
                )}
                
                <p className="text-xs text-muted-foreground">Tus datos se enviarán únicamente al hotel asociado a este enlace. El personal verificará la identidad en recepción.</p>
                <Button type="submit" className="w-full" disabled={submit.isPending}>Enviar pre-registro</Button>
                {submit.isError && <p role="alert" className="text-sm font-semibold text-destructive">{submit.error.message}</p>}
            </form>
        </main>
    );
}

function Field({ id, label, children }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function CheckinError({ message }) { return <main id="main-content" className="min-h-screen grid place-items-center p-6"><div role="alert" className="max-w-md rounded-2xl border bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h1 className="font-black">Pre check-in no disponible</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>; }
