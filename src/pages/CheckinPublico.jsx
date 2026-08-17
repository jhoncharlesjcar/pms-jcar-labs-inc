import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

async function invokeCheckin(body) {
    const { data, error } = await supabase.functions.invoke('public-checkin', { body });
    if (error) throw new Error('El pre check-in seguro no está disponible. Completa el registro en recepción.');
    if (!data || data.error) throw new Error(data?.error || 'El enlace es inválido o expiró.');
    return data;
}

export default function CheckinPublico() {
    const { token } = useParams();
    const [form, setForm] = useState({ nombre: '', tipo_documento: 'DNI', documento: '', telefono: '', email: '', observaciones: '' });
    const [done, setDone] = useState(false);
    const context = useQuery({ queryKey: ['public-checkin-context', token], queryFn: () => invokeCheckin({ action: 'load', token }), enabled: Boolean(token), retry: false });
    const submit = useMutation({
        mutationFn: () => invokeCheckin({ action: 'submit', token, guest: form }),
        onSuccess: () => setDone(true),
    });

    if (!token || context.isError) return <CheckinError message={context.error?.message || 'El enlace es incompleto.'} />;
    if (context.isPending) return <main id="main-content" className="min-h-screen grid place-items-center"><p role="status">Validando enlace…</p></main>;
    if (done) return <main id="main-content" className="min-h-screen grid place-items-center p-6"><section className="max-w-md rounded-3xl border bg-card p-8 text-center"><h1 className="text-2xl font-black">Registro enviado</h1><p className="mt-3 text-sm text-muted-foreground">Recepción validará tus datos y documentos al llegar.</p></section></main>;

    return (
        <main id="main-content" className="min-h-screen bg-background p-5 py-10">
            <form className="mx-auto max-w-xl space-y-5 rounded-3xl border bg-card p-6" onSubmit={e => { e.preventDefault(); submit.mutate(); }}>
                <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Pre check-in seguro</p><h1 className="mt-1 text-2xl font-black">{context.data.hotel?.nombre || 'Hotel'}</h1></header>
                <Field id="checkin-name" label="Nombre completo"><Input id="checkin-name" required autoComplete="name" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} /></Field>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field id="checkin-doc-type" label="Tipo de documento"><select id="checkin-doc-type" className="flex h-10 w-full rounded-md border bg-background px-3" value={form.tipo_documento} onChange={e => setForm({ ...form, tipo_documento: e.target.value })}><option>DNI</option><option>Pasaporte</option><option>CE</option></select></Field>
                    <Field id="checkin-doc" label="Número de documento"><Input id="checkin-doc" required value={form.documento} onChange={e => setForm({ ...form, documento: e.target.value })} /></Field>
                </div>
                <Field id="checkin-phone" label="Teléfono"><Input id="checkin-phone" required type="tel" autoComplete="tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} /></Field>
                <Field id="checkin-email" label="Correo (opcional)"><Input id="checkin-email" type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field>
                <Field id="checkin-notes" label="Observaciones"><textarea id="checkin-notes" className="min-h-24 w-full rounded-md border bg-background p-3" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} /></Field>
                <p className="text-xs text-muted-foreground">Tus datos se enviarán únicamente al hotel asociado a este enlace. El personal verificará la identidad en recepción.</p>
                <Button type="submit" className="w-full" disabled={submit.isPending}>Enviar pre-registro</Button>
                {submit.isError && <p role="alert" className="text-sm font-semibold text-destructive">{submit.error.message}</p>}
            </form>
        </main>
    );
}

function Field({ id, label, children }) { return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function CheckinError({ message }) { return <main id="main-content" className="min-h-screen grid place-items-center p-6"><div role="alert" className="max-w-md rounded-2xl border bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h1 className="font-black">Pre check-in no disponible</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>; }
