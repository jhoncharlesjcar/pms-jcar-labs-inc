import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Facebook, Globe2, Instagram, MessageCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';

const channelDefinitions = [
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
    { id: 'instagram', name: 'Instagram', icon: Instagram },
    { id: 'facebook', name: 'Facebook Messenger', icon: Facebook },
    { id: 'web', name: 'Chat web', icon: Globe2 },
];

export default function ChannelManager({ hotelId }) {
    const queryClient = useQueryClient();
    const connectionsQuery = useQuery({
        queryKey: ['ai-channels', hotelId],
        queryFn: () => AIService.getChannelConnections(hotelId),
        enabled: Boolean(hotelId),
    });

    if (connectionsQuery.isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando canales…</div>;

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">Canales de conversación</h2>
                <p className="text-sm text-muted-foreground">Configura los identificadores operativos. Las credenciales privadas permanecen en el servidor o en el conector propio.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {channelDefinitions.map((definition) => (
                    <ChannelCard
                        key={definition.id}
                        definition={definition}
                        hotelId={hotelId}
                        connection={connectionsQuery.data?.find((item) => item.channel === definition.id)}
                        onSaved={() => queryClient.invalidateQueries({ queryKey: ['ai-channels', hotelId] })}
                    />
                ))}
            </div>
        </div>
    );
}

function ChannelCard({ definition, hotelId, connection, onSaved }) {
    const Icon = definition.icon;
    const [form, setForm] = useState({
        enabled: false,
        external_account_id: '',
        response_delay_seconds: 0,
        max_concurrent_messages: 1,
    });

    useEffect(() => {
        setForm({
            enabled: Boolean(connection?.enabled),
            external_account_id: connection?.external_account_id || '',
            response_delay_seconds: connection?.response_delay_seconds || 0,
            max_concurrent_messages: connection?.max_concurrent_messages || 1,
        });
    }, [connection]);

    const saveMutation = useMutation({
        mutationFn: () => AIService.saveChannelConnection(hotelId, definition.id, {
            ...form,
            name: definition.name,
            status: connection?.status || 'disconnected',
            external_account_id: form.external_account_id || null,
            public_config: connection?.public_config || {},
        }),
        onSuccess: () => { toast.success(`${definition.name} actualizado`); onSaved(); },
        onError: (error) => toast.error(error?.message || `No se pudo guardar ${definition.name}`),
    });

    return (
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <div>
                    <h3 className="font-semibold">{definition.name}</h3>
                    <p className="text-xs capitalize text-muted-foreground">Estado: {connection?.status || 'disconnected'}</p>
                </div>
                <label className="ml-auto flex items-center gap-2 text-xs font-medium">
                    Activo
                    <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} className="h-4 w-4 accent-primary" />
                </label>
            </div>
            <label className="block space-y-1 text-xs font-semibold">ID de cuenta en el conector
                <input value={form.external_account_id} onChange={(event) => setForm((current) => ({ ...current, external_account_id: event.target.value }))} placeholder="Identificador externo" className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-semibold">Delay
                    <input type="number" min="0" max="120" value={form.response_delay_seconds} onChange={(event) => setForm((current) => ({ ...current, response_delay_seconds: Number(event.target.value) }))} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
                </label>
                <label className="space-y-1 text-xs font-semibold">Concurrencia
                    <input type="number" min="1" max="50" value={form.max_concurrent_messages} onChange={(event) => setForm((current) => ({ ...current, max_concurrent_messages: Number(event.target.value) }))} className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
                </label>
            </div>
            <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-4 w-4" /> {saveMutation.isPending ? 'Guardando…' : 'Guardar canal'}
            </button>
        </div>
    );
}
