import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Copy, Facebook, Globe2, Instagram, KeyRound, MessageCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';
import { ChannelFormSchema } from '@/pages/JcarAI/validation';

const channelDefinitions = [
    { id: 'whatsapp', name: 'WhatsApp', icon: MessageCircle },
    { id: 'instagram', name: 'Instagram', icon: Instagram },
    { id: 'facebook', name: 'Facebook Messenger', icon: Facebook },
    { id: 'web', name: 'Chat web', icon: Globe2 },
];

/** @typedef {import('@/types/ai.types').AIChannelConnection} AIChannelConnection */

export default function ChannelManager({ hotelId }) {
    const queryClient = useQueryClient();
    const connectionsQuery = useQuery({
        queryKey: ['ai-channels', hotelId],
        queryFn: () => AIService.getChannelConnections(hotelId),
        enabled: Boolean(hotelId),
    });

    if (connectionsQuery.isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando canales…</div>;
    if (connectionsQuery.isError) return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">No se pudieron cargar los canales: {connectionsQuery.error?.message}</div>;

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
    /** @type {{ credential_id: string; secret: string } | null} */
    const [issuedCredential, setIssuedCredential] = useState(null);

    useEffect(() => {
        setForm({
            enabled: Boolean(connection?.enabled),
            external_account_id: connection?.external_account_id || '',
            response_delay_seconds: connection?.response_delay_seconds || 0,
            max_concurrent_messages: connection?.max_concurrent_messages || 1,
        });
    }, [connection]);

    const saveMutation = useMutation({
        mutationFn: () => {
            const parsed = ChannelFormSchema.safeParse({
                channelId: definition.id,
                enabled: form.enabled,
                external_account_id: form.external_account_id,
                response_delay_seconds: Number(form.response_delay_seconds),
                max_concurrent_messages: Number(form.max_concurrent_messages),
                connectionStatus: connection?.status,
            });
            if (!parsed.success) {
                throw new Error(parsed.error.issues[0]?.message || 'Datos de canal inválidos');
            }
            return AIService.saveChannelConnection(hotelId, definition.id, {
                ...form, name: definition.name,
                status: connection?.status || 'disconnected',
                external_account_id: form.external_account_id.trim() || null,
                public_config: connection?.public_config || {},
            });
        },
        onSuccess: () => { toast.success(`${definition.name} actualizado`); onSaved(); },
        onError: (error) => toast.error(error?.message || `No se pudo guardar ${definition.name}`),
    });

    const healthMutation = useMutation({
        mutationFn: () => {
            if (!connection?.id) throw new Error('Guarda primero la configuración del canal');
            return AIService.checkChannelHealth(connection.id);
        },
        onSuccess: () => { toast.success(`${definition.name} respondió correctamente`); onSaved(); },
        onError: (error) => toast.error(error?.message || `No se pudo conectar con ${definition.name}`),
    });

    const credentialMutation = useMutation({
        mutationFn: () => {
            if (!connection?.id) throw new Error('Guarda primero la configuración del canal');
            if (!connection.external_account_id) throw new Error('Guarda el ID de cuenta antes de crear la credencial');
            return AIService.provisionChannelCredential(connection.id);
        },
        onSuccess: (credential) => {
            setIssuedCredential(credential);
            onSaved();
            toast.success('Credencial creada. Cópiala ahora: el secreto no volverá a mostrarse.');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo crear la credencial'),
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
            {definition.id !== 'web' && (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs"><span className="font-semibold">Credencial del conector</span><span className="font-mono text-muted-foreground">{connection?.credential_id || 'Sin provisionar'}</span></div>
                    <button type="button" onClick={() => credentialMutation.mutate()} disabled={!connection?.id || credentialMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50"><KeyRound className="h-4 w-4" />{credentialMutation.isPending ? 'Generando…' : connection?.credential_id ? 'Rotar credencial' : 'Provisionar credencial'}</button>
                    {issuedCredential && (
                        <div role="alert" className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                            <p className="font-bold text-amber-700 dark:text-amber-300">Copia este secreto ahora. Por seguridad se mostrará una sola vez y la credencial anterior dejó de ser válida.</p>
                            <p className="break-all font-mono">ID: {issuedCredential.credential_id}</p><p className="break-all font-mono">Secret: {issuedCredential.secret}</p>
                            <button type="button" onClick={() => { navigator.clipboard.writeText(`${issuedCredential.credential_id}:${issuedCredential.secret}`); toast.success('Credencial copiada'); }} className="flex items-center gap-2 rounded bg-foreground px-3 py-2 font-semibold text-background"><Copy className="h-3.5 w-3.5" />Copiar credencial</button>
                        </div>
                    )}
                </div>
            )}
            <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => healthMutation.mutate()} disabled={!connection?.credential_id || healthMutation.isPending || definition.id === 'web'} className="flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-semibold disabled:opacity-50"><Activity className="h-4 w-4" />{healthMutation.isPending ? 'Probando…' : 'Probar'}</button>
                <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Save className="h-4 w-4" />{saveMutation.isPending ? 'Guardando…' : 'Guardar'}</button>
            </div>
            {definition.id !== 'web' && <p className="text-[11px] text-muted-foreground">Orden recomendado: guardar ID de cuenta → provisionar credencial → probar conexión → activar canal.</p>}
        </div>
    );
}
