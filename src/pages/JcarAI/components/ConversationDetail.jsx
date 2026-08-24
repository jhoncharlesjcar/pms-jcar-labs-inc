import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Bot, CreditCard, User, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';
import { useAuth } from '@/contexts/AuthContext';

export default function ConversationDetail({ conversationId, onBack }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [paymentReference, setPaymentReference] = useState('');

    const messagesQuery = useQuery({
        queryKey: ['ai-messages', conversationId],
        queryFn: () => AIService.getMessages(conversationId),
        refetchInterval: 5000,
    });
    const contextQuery = useQuery({
        queryKey: ['ai-booking-context', conversationId],
        queryFn: () => AIService.getBookingContext(conversationId),
        refetchInterval: 5000,
    });

    const takeover = useMutation({
        mutationFn: () => AIService.takeoverConversation(conversationId, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            toast.success('Ahora controlas esta conversación');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo tomar la conversación'),
    });

    const verifyPayment = useMutation({
        mutationFn: () => AIService.verifyManualPayment(contextQuery.data.payment.id, paymentReference),
        onSuccess: () => {
            setPaymentReference('');
            queryClient.invalidateQueries({ queryKey: ['ai-booking-context', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            toast.success('Pago verificado y reserva confirmada');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo verificar el pago'),
    });

    const booking = contextQuery.data;
    const paymentCanBeVerified = booking?.payment?.provider === 'manual'
        && ['pending', 'awaiting_manual_review'].includes(booking.payment.status);

    return (
        <div className="flex min-h-[650px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card/30">
            <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-4">
                <button type="button" aria-label="Volver" onClick={onBack} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h3 className="font-semibold">Conversación y ciclo de reserva</h3>
                    <p className="text-xs text-muted-foreground">ID: {conversationId}</p>
                </div>
                <button type="button" onClick={() => takeover.mutate()} disabled={takeover.isPending} className="ml-auto rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                    {takeover.isPending ? 'Asignando…' : 'Tomar control manual'}
                </button>
            </div>

            {booking && (booking.intent || booking.hold || booking.payment) && (
                <div className="grid grid-cols-1 gap-3 border-b border-border bg-background/40 p-4 md:grid-cols-3">
                    <StatusCard label="Intención" value={booking.intent?.status || 'Sin intención'} detail={booking.intent ? `${booking.intent.fecha_entrada} → ${booking.intent.fecha_salida}` : undefined} />
                    <StatusCard label="Hold" value={booking.hold?.status || 'Sin hold'} detail={booking.hold?.expires_at ? `Vence ${format(new Date(booking.hold.expires_at), 'dd/MM HH:mm', { locale: es })}` : undefined} />
                    <StatusCard label="Pago" value={booking.payment?.status || 'Sin pago'} detail={booking.payment ? `${booking.payment.currency} ${Number(booking.payment.amount).toFixed(2)} · ${booking.payment.method}` : undefined} icon={<CreditCard className="h-4 w-4" />} />
                </div>
            )}

            {paymentCanBeVerified && (
                <div className="flex flex-col gap-3 border-b border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-end">
                    <label className="flex-1 space-y-1 text-xs font-semibold">Referencia del pago manual
                        <input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Ej. operación 845921" className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-normal" />
                    </label>
                    <button type="button" disabled={paymentReference.trim().length < 3 || verifyPayment.isPending} onClick={() => verifyPayment.mutate()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                        {verifyPayment.isPending ? 'Verificando…' : 'Verificar y confirmar'}
                    </button>
                </div>
            )}

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                {messagesQuery.isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Cargando mensajes…</div>
                ) : !messagesQuery.data?.length ? (
                    <div className="p-8 text-center text-muted-foreground">No hay mensajes.</div>
                ) : (
                    <div className="space-y-6">
                        {messagesQuery.data.map((message) => {
                            if (message.role === 'system') return null;
                            if (message.role === 'tool') {
                                return (
                                    <div key={message.id} className="flex justify-center">
                                        <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                                            <Wrench className="h-3 w-3" /> JcarAI ejecutó <strong className="font-mono">{message.tool_name}</strong>
                                        </div>
                                    </div>
                                );
                            }
                            const isUser = message.role === 'user';
                            return (
                                <div key={message.id} className={`flex max-w-[85%] gap-3 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-primary text-primary-foreground' : 'border border-blue-500/20 bg-blue-500/10 text-blue-500'}`}>
                                        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                    </div>
                                    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                                        <div className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isUser ? 'rounded-tr-none bg-primary text-primary-foreground' : 'rounded-tl-none border border-border bg-card'}`}>{message.content}</div>
                                        <span className="px-1 text-[10px] text-muted-foreground">{format(new Date(message.created_at), 'HH:mm', { locale: es })}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusCard({ label, value, detail, icon }) {
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
            <p className="mt-1 text-sm font-bold capitalize">{String(value).replaceAll('_', ' ')}</p>
            {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
        </div>
    );
}
