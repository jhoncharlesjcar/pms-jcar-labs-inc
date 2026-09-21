import React from 'react';
import { ArrowLeft, Bot, BotOff } from 'lucide-react';

/** @typedef {import('@/types/ai.types').AIConversation} AIConversation */

/**
 * @param {{
 *   conversation?: AIConversation,
 *   conversationId: string,
 *   isControlledByHuman: boolean,
 *   isTakeoverPending: boolean,
 *   isReleasePending: boolean,
 *   onBack: () => void,
 *   onTakeover: () => void,
 *   onRelease: () => void,
 * }} props
 */
export default function ConversationHeader({
    conversationId,
    isControlledByHuman,
    isTakeoverPending,
    isReleasePending,
    onBack,
    onTakeover,
    onRelease,
}) {
    return (
        <div className="flex items-center gap-4 border-b border-border bg-muted/20 p-4">
            <button
                type="button"
                aria-label="Volver"
                onClick={onBack}
                className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
                <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
                <h3 className="font-semibold">Conversación y ciclo de reserva</h3>
                <p className="text-xs text-muted-foreground">ID: {conversationId}</p>
            </div>
            {isControlledByHuman ? (
                <button
                    type="button"
                    onClick={onRelease}
                    disabled={isReleasePending}
                    className="ml-auto flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                    <Bot className="h-4 w-4" />
                    {isReleasePending ? 'Liberando…' : 'Devolver a JcarAI'}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={onTakeover}
                    disabled={isTakeoverPending}
                    className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                    <BotOff className="h-4 w-4" />
                    {isTakeoverPending ? 'Asignando…' : 'Tomar control manual'}
                </button>
            )}
        </div>
    );
}
