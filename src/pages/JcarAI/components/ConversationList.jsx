import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, CalendarCheck, Clock, Phone, User } from 'lucide-react';
import { AIService } from '@/services/ai.service';
import ConversationDetail from './ConversationDetail.jsx';

const filters = [
    ['all', 'Todas'], ['active', 'Activas'], ['quoted', 'Cotizadas'],
    ['payment_pending', 'Esperando pago'], ['booked', 'Confirmadas'], ['handed_off', 'Transferidas'],
];

const statusStyles = {
    active: ['En curso', 'bg-blue-500/10 text-blue-500'],
    quoted: ['Cotizada', 'bg-amber-500/10 text-amber-500'],
    payment_pending: ['Esperando pago', 'bg-orange-500/10 text-orange-500'],
    booked: ['Confirmada', 'bg-emerald-500/10 text-emerald-500'],
    handed_off: ['Control humano', 'bg-purple-500/10 text-purple-500'],
    abandoned: ['Abandonada', 'bg-slate-500/10 text-slate-500'],
    closed: ['Cerrada', 'bg-slate-500/10 text-slate-500'],
};

/** @typedef {import('@/types/ai.types').AIConversation} AIConversation */

export default function ConversationList({ hotelId }) {
    const [statusFilter, setStatusFilter] = useState('all');
    /** @type {string | null} */
    const [selectedConversationId, setSelectedConversationId] = useState(null);
    const conversationsQuery = useQuery({
        queryKey: ['ai-conversations', hotelId, statusFilter],
        queryFn: () => AIService.getConversations(hotelId, statusFilter),
        refetchInterval: 10000,
    });

    if (selectedConversationId) {
        return <ConversationDetail conversationId={selectedConversationId} onBack={() => setSelectedConversationId(null)} />;
    }

    return (
        <div className="space-y-4">
            <div className="flex w-full gap-2 overflow-x-auto pb-2">
                {filters.map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${statusFilter === value ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
                        {label}
                    </button>
                ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 shadow-sm">
                {conversationsQuery.isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Cargando conversaciones…</div>
                ) : conversationsQuery.isError ? (
                    <div role="alert" className="p-8 text-center text-destructive">No se pudieron cargar las conversaciones. {conversationsQuery.error?.message}<button type="button" onClick={() => conversationsQuery.refetch()} className="ml-2 underline">Reintentar</button></div>
                ) : !conversationsQuery.data?.length ? (
                    <div className="flex flex-col items-center p-12 text-center text-muted-foreground">
                        <Bot className="mb-4 h-12 w-12 opacity-20" />
                        <p className="text-lg font-medium">No hay conversaciones</p>
                        <p className="text-sm">JcarAI está esperando mensajes de los canales conectados.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {conversationsQuery.data.map((conversation) => {
                            const [statusLabel, statusClass] = statusStyles[conversation.status] || [conversation.status, 'bg-muted text-muted-foreground'];
                            return (
                                <button key={conversation.id} type="button" onClick={() => setSelectedConversationId(conversation.id)} className="flex w-full flex-col justify-between gap-4 p-4 text-left transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
                                        <div>
                                            <div className="mb-1 flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold">{conversation.guest_name || 'Huésped anónimo'}</h3>
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
                                                <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{conversation.channel}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                                {conversation.guest_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{conversation.guest_phone}</span>}
                                                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Actualizada {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true, locale: es })}</span>
                                                {conversation.journey_stage && <span className="capitalize">Etapa: {conversation.journey_stage.replaceAll('_', ' ')}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    {conversation.reserva_id && <span className="flex items-center gap-1 self-end rounded bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 sm:self-auto"><CalendarCheck className="h-3 w-3" />Reserva confirmada</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
