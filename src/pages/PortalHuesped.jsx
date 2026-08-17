import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, MessageCircle, ShieldAlert } from 'lucide-react';
import { supabase } from '@/config/supabase';
import { Button } from '@/components/ui/button';

async function loadPortal(token) {
    const { data, error } = await supabase.functions.invoke('guest-portal', { body: { action: 'load', token } });
    if (error) throw new Error('El portal seguro no está disponible. Solicita un enlace nuevo en recepción.');
    if (!data?.reservation || data.error) throw new Error(data?.error || 'El enlace es inválido o expiró.');
    return data;
}

export default function PortalHuesped() {
    const { token } = useParams();
    const portal = useQuery({
        queryKey: ['guest-portal', token],
        queryFn: () => loadPortal(token),
        enabled: Boolean(token),
        retry: false,
    });

    if (!token || portal.isError) return <PortalError message={portal.error?.message || 'El enlace es incompleto.'} />;
    if (portal.isPending) return <main id="main-content" className="min-h-screen grid place-items-center"><p role="status">Validando enlace…</p></main>;

    const stay = portal.data.reservation;
    const hotel = portal.data.hotel;
    const openWhatsApp = () => {
        const phone = String(hotel?.whatsapp || '').replace(/\D/g, '');
        if (!phone) return;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent('Hola recepción, necesito asistencia con mi estadía.')}`, '_blank', 'noopener,noreferrer');
    };

    return (
        <main id="main-content" className="min-h-screen bg-muted/30 p-5 pb-16">
            <div className="mx-auto max-w-lg space-y-4">
                <header className="rounded-3xl bg-primary p-7 text-primary-foreground shadow-lg">
                    <p className="text-xs font-bold uppercase tracking-widest">Bienvenido(a)</p>
                    <h1 className="mt-1 text-2xl font-black">{stay.huesped_nombre?.split(' ')[0] || 'Huésped'}</h1>
                    <p className="mt-2 text-sm">{hotel?.nombre}</p>
                </header>
                <section aria-labelledby="stay-title" className="rounded-2xl border bg-card p-6 shadow-sm">
                    <h2 id="stay-title" className="flex items-center gap-2 font-black"><Clock className="h-4 w-4 text-primary" /> Tu estadía</h2>
                    <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <div><dt className="text-muted-foreground">Habitación</dt><dd className="font-bold">{stay.habitacion_numero}</dd></div>
                        <div><dt className="text-muted-foreground">Check-out</dt><dd className="font-bold">{stay.fecha_salida}</dd></div>
                        {stay.total != null && <div><dt className="text-muted-foreground">Total</dt><dd className="font-bold">S/ {Number(stay.total).toFixed(2)}</dd></div>}
                        <div><dt className="text-muted-foreground">Estado</dt><dd className="font-bold">{stay.estado}</dd></div>
                    </dl>
                </section>
                {hotel?.whatsapp && <Button className="w-full gap-2" onClick={openWhatsApp}><MessageCircle className="h-4 w-4" /> Contactar recepción</Button>}
                <p className="text-center text-xs text-muted-foreground">Los pedidos y cargos solo se confirman directamente con recepción.</p>
            </div>
        </main>
    );
}

function PortalError({ message }) {
    return <main id="main-content" className="min-h-screen grid place-items-center p-6"><div role="alert" className="max-w-md rounded-2xl border bg-card p-6 text-center"><ShieldAlert className="mx-auto mb-3 h-8 w-8 text-destructive" /><h1 className="font-black">Portal no disponible</h1><p className="mt-2 text-sm text-muted-foreground">{message}</p></div></main>;
}
