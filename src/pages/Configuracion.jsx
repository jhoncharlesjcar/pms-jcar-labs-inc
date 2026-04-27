import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Settings, Save, ExternalLink, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useHotelData } from '@/hooks/use-hotel-data';

export default function Configuracion() {
    const qc = useQueryClient();
    const { db: hotelDb, hotelId } = useHotelData();
    const [saved, setSaved] = useState(false);
    const [form, setForm] = useState({
        nombre: '', ruc: '', direccion: '', telefono: '', email: '',
        ciudad: '', modo_sunat: 'manual', mensaje_ticket: '¡Gracias por su preferencia!',
        hora_checkin: '14:00', hora_checkout: '12:00',
    });
    const [configId, setConfigId] = useState(null);

    const { data: configs = [] } = useQuery({
        queryKey: ['config', hotelId],
        queryFn: () => hotelDb.ConfigHotel.list(),
        enabled: !!hotelId,
    });

    useEffect(() => {
        if (configs.length > 0) {
            const c = configs[0];
            setConfigId(c.id);
            setForm({
                nombre: c.nombre || '',
                ruc: c.ruc || '',
                direccion: c.direccion || '',
                telefono: c.telefono || '',
                email: c.email || '',
                ciudad: c.ciudad || '',
                modo_sunat: c.modo_sunat || 'manual',
                mensaje_ticket: c.mensaje_ticket || '¡Gracias por su preferencia!',
                hora_checkin: c.hora_checkin || '14:00',
                hora_checkout: c.hora_checkout || '12:00',
            });
        }
    }, [configs]);

    const guardar = useMutation({
        mutationFn: () => configId
            ? hotelDb.ConfigHotel.update(configId, form)
            : hotelDb.ConfigHotel.create(form),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['config'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const modoSunatInfo = {
        manual: { label: 'Manual (Recomendado para hospedajes pequeños)', desc: 'El recepcionista decide cuándo ir a SUNAT. Perfecto para operar con tickets internos.' },
        automatico: { label: 'Automático (Empresas formales)', desc: 'Recordatorio automático para emitir comprobante en cada venta.' },
        desactivado: { label: 'Desactivado', desc: 'Sin módulo SUNAT. Solo tickets internos.' },
    };

    return (
        <div className="space-y-8 max-w-2xl">
            <div>
                <h1 className="font-display text-3xl font-bold text-foreground">Configuración</h1>
                <p className="text-muted-foreground mt-1">Datos del hospedaje y preferencias del sistema</p>
            </div>

            {/* Datos del hotel */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <h2 className="font-semibold text-foreground">Datos del Hospedaje</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <Label>Nombre del hospedaje *</Label>
                        <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Hospedaje Los Andes" className="mt-1" />
                    </div>
                    <div>
                        <Label>RUC (opcional)</Label>
                        <Input value={form.ruc} onChange={e => setForm({ ...form, ruc: e.target.value })} placeholder="20XXXXXXXXX" className="mt-1" />
                    </div>
                    <div>
                        <Label>Ciudad</Label>
                        <Input value={form.ciudad} onChange={e => setForm({ ...form, ciudad: e.target.value })} placeholder="Cusco, Lima..." className="mt-1" />
                    </div>
                    <div className="sm:col-span-2">
                        <Label>Dirección</Label>
                        <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} placeholder="Jr. Principal 123" className="mt-1" />
                    </div>
                    <div>
                        <Label>Teléfono / WhatsApp</Label>
                        <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} placeholder="999 888 777" className="mt-1" />
                    </div>
                    <div>
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="hospedaje@email.com" className="mt-1" />
                    </div>
                </div>
            </div>

            {/* Horarios */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <h2 className="font-semibold text-foreground">Horarios</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label>Hora de Check-in</Label>
                        <Input type="time" value={form.hora_checkin} onChange={e => setForm({ ...form, hora_checkin: e.target.value })} className="mt-1" />
                    </div>
                    <div>
                        <Label>Hora de Check-out</Label>
                        <Input type="time" value={form.hora_checkout} onChange={e => setForm({ ...form, hora_checkout: e.target.value })} className="mt-1" />
                    </div>
                </div>
            </div>

            {/* Ticket */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <h2 className="font-semibold text-foreground">Mensaje en el Ticket</h2>
                <div>
                    <Label>Mensaje de agradecimiento</Label>
                    <Input value={form.mensaje_ticket} onChange={e => setForm({ ...form, mensaje_ticket: e.target.value })} placeholder="¡Gracias por su preferencia!" className="mt-1" />
                </div>
            </div>

            {/* Módulo SUNAT */}
            <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-foreground">Módulo SUNAT</h2>
                    <button
                        onClick={() => window.open('https://e-menu.sunat.gob.pe/cl-ti-itmenu/MenuInternet.htm', '_blank')}
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                    >
                        <ExternalLink className="w-3.5 h-3.5" /> Ir al portal SUNAT
                    </button>
                </div>

                <div className="space-y-3">
                    {Object.entries(modoSunatInfo).map(([key, info]) => (
                        <button
                            key={key}
                            onClick={() => setForm({ ...form, modo_sunat: key })}
                            className={cn(
                                "w-full text-left p-4 rounded-xl border-2 transition-all",
                                form.modo_sunat === key
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/40"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <div className={cn(
                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                                    form.modo_sunat === key ? "border-primary" : "border-muted-foreground"
                                )}>
                                    {form.modo_sunat === key && <div className="w-2 h-2 rounded-full bg-primary" />}
                                </div>
                                <p className="font-medium text-foreground text-sm">{info.label}</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 ml-6">{info.desc}</p>
                        </button>
                    ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
                    <strong>Nota SUNAT Perú:</strong> El sistema guarda el historial completo de ventas para cumplir con la normativa. Cuando un cliente solicite comprobante, puedes emitirlo directamente en el portal web de SUNAT usando tu Clave SOL.
                </div>
            </div>

            {/* Guardar */}
            <div className="flex items-center gap-4">
                <Button onClick={() => guardar.mutate()} disabled={guardar.isPending || !form.nombre} className="gap-2 px-8">
                    {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> {guardar.isPending ? 'Guardando...' : 'Guardar Configuración'}</>}
                </Button>
                {saved && <span className="text-sm text-green-600 font-medium">¡Configuración guardada!</span>}
            </div>
        </div>
    );
}