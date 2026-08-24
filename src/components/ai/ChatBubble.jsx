import React, { useEffect, useRef, useState } from 'react';
import { AIService } from '@/services/ai.service';
import { Bot, Send, X } from 'lucide-react';
import { toast } from 'sonner';

export default function ChatBubble({ hotelId }) {
    const [hotelConfig, setHotelConfig] = useState(null);
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [sessionToken, setSessionToken] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!hotelId) return;
        let cancelled = false;
        const sessionKey = `jcar_ai_session:${hotelId}`;
        const tokenKey = `jcar_ai_token:${hotelId}`;

        AIService.bootstrapSession(
            hotelId,
            sessionStorage.getItem(sessionKey) || undefined,
            sessionStorage.getItem(tokenKey) || undefined,
        ).then((bootstrap) => {
            if (cancelled) return;
            sessionStorage.setItem(sessionKey, bootstrap.session_id);
            sessionStorage.setItem(tokenKey, bootstrap.session_token);
            setSessionId(bootstrap.session_id);
            setSessionToken(bootstrap.session_token);
            setHotelConfig(bootstrap.config);
            setMessages([{
                id: 'welcome', role: 'assistant',
                content: bootstrap.config?.welcome_message || '¡Hola! ¿En qué puedo ayudarte?',
            }]);
        }).catch(() => {
            if (!cancelled) setHotelConfig({ agent_enabled: false });
        });

        return () => { cancelled = true; };
    }, [hotelId]);

    useEffect(() => {
        if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen, isTyping]);

    const handleSend = async (event) => {
        event?.preventDefault();
        if (!input.trim() || isTyping || !sessionId || !sessionToken) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((current) => [...current, {
            id: `${Date.now()}-user`, role: 'user', content: userMessage,
        }]);
        setIsTyping(true);

        try {
            const response = await AIService.sendMessage(
                hotelId, sessionId, sessionToken, userMessage,
            );
            setMessages((current) => [...current, {
                id: `${Date.now()}-assistant`, role: 'assistant', content: response.response,
            }]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
            setMessages((current) => [...current, {
                id: `${Date.now()}-error`, role: 'system',
                content: 'No pudimos procesar tu mensaje. Intenta nuevamente.',
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    if (!hotelConfig?.agent_enabled) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {!isOpen && (
                <button
                    type="button"
                    aria-label="Abrir conversación con JcarAI"
                    onClick={() => setIsOpen(true)}
                    className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_25px_-5px_hsl(var(--primary)/0.5)] transition-transform hover:scale-105"
                >
                    <Bot className="h-7 w-7" />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-primary bg-emerald-500" />
                    </span>
                    <span className="pointer-events-none absolute right-full mr-4 whitespace-nowrap rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
                        Consultar disponibilidad
                    </span>
                </button>
            )}

            {isOpen && (
                <div className="flex h-[550px] max-h-[80vh] w-[350px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-8">
                    <div className="flex items-center justify-between bg-primary p-4 text-primary-foreground shadow-md">
                        <div className="flex items-center gap-3">
                            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                                <Bot className="h-6 w-6" />
                                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-primary bg-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold leading-tight">{hotelConfig.agent_name || 'JcarAI'}</h3>
                                <p className="text-[11px] font-medium text-primary-foreground/80">Vendedor y recepcionista digital</p>
                            </div>
                        </div>
                        <button type="button" aria-label="Cerrar chat" onClick={() => setIsOpen(false)} className="rounded-full p-2 hover:bg-white/20">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-muted/20 p-4">
                        {messages.map((message) => {
                            if (message.role === 'system') {
                                return <div key={message.id} className="my-2 text-center text-xs font-medium text-destructive">{message.content}</div>;
                            }
                            const isUser = message.role === 'user';
                            return (
                                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex max-w-[88%] gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
                                        {!isUser && <div className="mt-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary"><Bot className="h-3.5 w-3.5" /></div>}
                                        <div className={`whitespace-pre-wrap px-4 py-2 text-sm shadow-sm ${isUser ? 'rounded-2xl rounded-br-sm bg-primary text-primary-foreground' : 'rounded-2xl rounded-bl-sm border border-border bg-card text-foreground'}`}>
                                            {message.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
                                    JcarAI está consultando el PMS…
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="border-t border-border bg-card p-3">
                        <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full border border-border/50 bg-muted/50 p-1.5 focus-within:border-primary/50">
                            <input
                                type="text"
                                maxLength={2000}
                                value={input}
                                onChange={(event) => setInput(event.target.value)}
                                placeholder="Escribe tu consulta…"
                                className="flex-1 border-none bg-transparent px-3 text-sm focus:ring-0"
                                disabled={isTyping || !sessionToken}
                            />
                            <button type="submit" aria-label="Enviar mensaje" disabled={!input.trim() || isTyping || !sessionToken} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50">
                                <Send className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                    <div className="bg-muted py-1.5 text-center text-[10px] text-muted-foreground/70">Desarrollado por JCAR LABS</div>
                </div>
            )}
        </div>
    );
}
