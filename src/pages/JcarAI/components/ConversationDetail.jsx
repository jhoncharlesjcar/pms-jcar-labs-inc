import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { es } from 'date-fns/locale';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';
import { useAuth } from '@/contexts/AuthContext';
import ConversationHeader from './ConversationHeader';
import MessageList from './MessageList';
import BookingStatusCards from './BookingStatusCards';
import PaymentVerificationPanel from './PaymentVerificationPanel';

export default function ConversationDetail({ conversationId, onBack }) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [paymentReference, setPaymentReference] = useState('');
    const [evidenceId, setEvidenceId] = useState('');
    const [reviewingEvidence, setReviewingEvidence] = useState(false);
    const [reply, setReply] = useState('');

    useEffect(() => {
        return () => {
            queryClient.cancelQueries({ queryKey: ['ai-messages', conversationId] });
            queryClient.cancelQueries({ queryKey: ['ai-booking-context', conversationId] });
            queryClient.cancelQueries({ queryKey: ['ai-conversation', conversationId] });
        };
    }, [conversationId, queryClient]);

    const conversationQuery = useQuery({
        queryKey: ['ai-conversation', conversationId],
        queryFn: () => AIService.getConversation(conversationId),
        refetchInterval: 5000,
    });

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

    const takeoverMutation = useMutation({
        mutationFn: () => AIService.takeoverConversation(conversationId, user.id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['ai-conversation', conversationId] });
            toast.success('Ahora controlas esta conversación');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo tomar la conversación'),
    });

    const releaseMutation = useMutation({
        mutationFn: () => AIService.releaseConversation(conversationId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['ai-conversation', conversationId] });
            toast.success('JcarAI retomó la conversación en la misma etapa');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo liberar la conversación'),
    });

    const sendReplyMutation = useMutation({
        mutationFn: () => AIService.sendHumanMessage(conversationId, reply),
        onSuccess: () => {
            setReply('');
            queryClient.invalidateQueries({ queryKey: ['ai-messages', conversationId] });
        },
        onError: (error) => toast.error(error?.message || 'No se pudo enviar el mensaje'),
    });

    const verifyPaymentMutation = useMutation({
        mutationFn: () => {
            const paymentId = contextQuery.data?.payment?.id;
            if (!paymentId) throw new Error('No hay un pago pendiente para verificar');
            return AIService.verifyManualPayment(paymentId, paymentReference, evidenceId);
        },
        onSuccess: () => {
            setPaymentReference('');
            setEvidenceId('');
            queryClient.invalidateQueries({ queryKey: ['ai-booking-context', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
            toast.success('Pago verificado y reserva confirmada');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo verificar el pago'),
    });

    const booking = contextQuery.data;
    const conversation = conversationQuery.data;
    const isControlledByHuman = Boolean(conversation?.human_controlled);
    const paymentCanBeVerified =
        booking?.payment?.provider === 'manual' &&
        ['pending', 'awaiting_manual_review'].includes(booking.payment.status);
    const unverifiedEvidence = (booking?.evidence || []).filter((item) => !item.verified_at);

    const handleTakeover = useCallback(() => {
        takeoverMutation.mutate();
    }, [takeoverMutation]);

    const handleRelease = useCallback(() => {
        releaseMutation.mutate();
    }, [releaseMutation]);

    const handleSendReply = useCallback(
        (event) => {
            event.preventDefault();
            if (reply.trim()) sendReplyMutation.mutate();
        },
        [reply, sendReplyMutation]
    );

    const handleVerifyPayment = useCallback(() => {
        verifyPaymentMutation.mutate();
    }, [verifyPaymentMutation]);

    const handleOpenEvidence = useCallback(async () => {
        if (!evidenceId) return;
        const preview = window.open('about:blank', '_blank');
        if (preview) preview.opener = null;
        setReviewingEvidence(true);
        try {
            const result = await AIService.getPaymentEvidenceReview(evidenceId);
            if (preview) preview.location.href = result.signed_url;
            else window.open(result.signed_url, '_blank', 'noopener,noreferrer');
        } catch (error) {
            preview?.close();
            toast.error(error?.message || 'No se pudo abrir la evidencia');
        } finally {
            setReviewingEvidence(false);
        }
    }, [evidenceId]);

    return (
        <div className="flex min-h-[650px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card/30">
            <ConversationHeader
                conversation={conversation}
                conversationId={conversationId}
                isControlledByHuman={isControlledByHuman}
                isTakeoverPending={takeoverMutation.isPending}
                isReleasePending={releaseMutation.isPending}
                onBack={onBack}
                onTakeover={handleTakeover}
                onRelease={handleRelease}
            />

            {(messagesQuery.isError || contextQuery.isError || conversationQuery.isError) && (
                <div
                    role="alert"
                    className="border-b border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
                >
                    No se pudo cargar toda la conversación.{' '}
                    {messagesQuery.error?.message ||
                        contextQuery.error?.message ||
                        conversationQuery.error?.message}
                </div>
            )}

            {booking && <BookingStatusCards booking={booking} locale={es} />}

            {paymentCanBeVerified && (
                <PaymentVerificationPanel
                    unverifiedEvidence={unverifiedEvidence}
                    selectedEvidenceId={evidenceId}
                    onEvidenceChange={setEvidenceId}
                    onOpenEvidence={handleOpenEvidence}
                    isReviewingEvidence={reviewingEvidence}
                    paymentReference={paymentReference}
                    onPaymentReferenceChange={setPaymentReference}
                    onVerifyPayment={handleVerifyPayment}
                    isVerifyingPayment={verifyPaymentMutation.isPending}
                    locale={es}
                />
            )}

            <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                <MessageList messages={messagesQuery.data || []} isLoading={messagesQuery.isLoading} />
            </div>

            {isControlledByHuman && (
                <form onSubmit={handleSendReply} className="flex gap-2 border-t bg-card p-3">
                    <label className="sr-only" htmlFor="human-reply">
                        Responder como personal del hotel
                    </label>
                    <textarea
                        id="human-reply"
                        rows={2}
                        maxLength={2000}
                        value={reply}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Responder como personal del hotel…"
                        className="min-h-11 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm"
                    />
                    <button
                        type="submit"
                        aria-label="Enviar respuesta"
                        disabled={!reply.trim() || sendReplyMutation.isPending}
                        className="self-end rounded-lg bg-primary p-3 text-primary-foreground disabled:opacity-50"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </form>
            )}
        </div>
    );
}
