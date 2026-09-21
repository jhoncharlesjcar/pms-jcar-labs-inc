import React from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, User, Wrench } from 'lucide-react';
import DOMPurify from 'dompurify';

/** @typedef {import('@/types/ai.types').AIMessage} AIMessage */

const deliveryLabels = {
    queued: 'en cola',
    processing: 'enviando',
    sent: 'enviado',
    delivered: 'entregado',
    read: 'leído',
    failed: 'falló',
};

/** @param {string} isoString */
function formatTime(isoString) {
    return format(new Date(isoString), 'HH:mm', { locale: es });
}

/** @param {{ message: AIMessage }} props */
function MessageItem({ message }) {
    if (message.role === 'system') return null;

    if (message.role === 'tool') {
        return (
            <div className="flex justify-center">
                <div className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    JcarAI ejecutó{' '}
                    <strong className="font-mono">{DOMPurify.sanitize(message.tool_name || '')}</strong>
                </div>
            </div>
        );
    }

    const isUser = message.role === 'user';
    const deliverySuffix =
        message.direction === 'outbound' && message.delivery_status
            ? ` · ${deliveryLabels[message.delivery_status] || message.delivery_status}`
            : '';

    return (
        <div className={`flex max-w-[85%] gap-3 ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
            <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-blue-500/20 bg-blue-500/10 text-blue-500'
                }`}
            >
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                    className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isUser
                            ? 'rounded-tr-none bg-primary text-primary-foreground'
                            : 'rounded-tl-none border border-border bg-card'
                    }`}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.content) }}
                />
                <span className="px-1 text-[10px] text-muted-foreground">
                    {formatTime(message.created_at)}
                    {deliverySuffix}
                </span>
            </div>
        </div>
    );
}

/**
 * @param {{ messages: AIMessage[], isLoading: boolean }} props
 */
export default function MessageList({ messages, isLoading }) {
    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Cargando mensajes…</div>;
    }

    if (!messages.length) {
        return <div className="p-8 text-center text-muted-foreground">No hay mensajes.</div>;
    }

    return (
        <div className="space-y-6">
            {messages.map((message) => (
                <MessageItem key={message.id} message={message} />
            ))}
        </div>
    );
}
