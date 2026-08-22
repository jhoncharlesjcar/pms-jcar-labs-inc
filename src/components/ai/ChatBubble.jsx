import React, { useState, useEffect, useRef } from 'react';
import { AIService } from '@/services/ai.service';
import { Bot, X, Send, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

export default function ChatBubble({ hotelId }) {
    const { data: hotelConfig } = useQuery({
        queryKey: ['ai-config', hotelId],
        queryFn: () => AIService.getConfig(hotelId),
        enabled: Boolean(hotelId)
    });

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const messagesEndRef = useRef(null);

    // Si el agente está desactivado, no renderizar nada
    if (!hotelConfig?.agent_enabled) return null;

    useEffect(() => {
        // Inicializar session_id
        let sid = sessionStorage.getItem('jcar_ai_session');
        if (!sid) {
            sid = crypto.randomUUID();
            sessionStorage.setItem('jcar_ai_session', sid);
        }
        setSessionId(sid);
        
        // Mensaje de bienvenida inicial (solo UI, en DB se crea en el primer POST)
        setMessages([
            { id: '1', role: 'assistant', content: hotelConfig?.welcome_message || '¡Hola! ¿En qué puedo ayudarte?', timestamp: new Date() }
        ]);
    }, [hotelConfig]);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, isTyping]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!input.trim() || isTyping) return;

        const userMsg = input.trim();
        setInput('');
        
        // Optimistic update
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: new Date() }]);
        setIsTyping(true);

        try {
            const res = await AIService.sendMessage(hotelId, sessionId, userMsg);
            
            setMessages(prev => [...prev, { 
                id: Date.now().toString(), 
                role: 'assistant', 
                content: res.response, 
                timestamp: new Date() 
            }]);

        } catch (error) {
            toast.error("Ocurrió un error al enviar el mensaje.");
            setMessages(prev => [...prev, { 
                id: Date.now().toString(), 
                role: 'system', 
                content: 'No pudimos procesar tu mensaje. Intenta nuevamente.', 
                timestamp: new Date() 
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Burbuja Principal */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-[0_10px_25px_-5px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform relative group"
                >
                    <Bot className="w-7 h-7" />
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-primary"></span>
                    </span>
                    
                    {/* Tooltip */}
                    <div className="absolute right-full mr-4 bg-foreground text-background text-sm font-medium px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        Chatea con nosotros
                        <div className="absolute right-[-4px] top-1/2 -translate-y-1/2 w-2 h-2 bg-foreground rotate-45"></div>
                    </div>
                </button>
            )}

            {/* Ventana de Chat */}
            {isOpen && (
                <div className="bg-card w-[350px] h-[550px] max-h-[80vh] flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-8 fade-in">
                    {/* Header */}
                    <div className="bg-primary p-4 text-primary-foreground flex items-center justify-between shadow-md relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm relative">
                                <Bot className="w-6 h-6 text-white" />
                                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-primary rounded-full"></span>
                            </div>
                            <div>
                                <h3 className="font-bold text-sm leading-tight">{hotelConfig?.agent_name || 'Asistente Virtual'}</h3>
                                <p className="text-[11px] text-primary-foreground/80 font-medium">Respuestas automáticas</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 custom-scrollbar">
                        <div className="text-center text-xs text-muted-foreground mb-4">
                            Hoy, {format(new Date(), "HH:mm", { locale: es })}
                        </div>
                        
                        {messages.map((msg, i) => {
                            const isUser = msg.role === 'user';
                            const isSystem = msg.role === 'system';

                            if (isSystem) {
                                return (
                                    <div key={msg.id} className="text-center text-xs text-destructive font-medium my-2">
                                        {msg.content}
                                    </div>
                                );
                            }

                            return (
                                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                    <div className={`flex gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : ''}`}>
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-auto ${isUser ? 'hidden' : 'bg-primary/20 text-primary'}`}>
                                            {!isUser && <Bot className="w-3.5 h-3.5" />}
                                        </div>
                                        <div className={`px-4 py-2 text-sm whitespace-pre-wrap ${
                                            isUser 
                                                ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm' 
                                                : 'bg-card border border-border text-foreground rounded-2xl rounded-bl-sm shadow-sm'
                                        }`}>
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {isTyping && (
                            <div className="flex justify-start">
                                <div className="flex gap-2 max-w-[85%]">
                                    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 mt-auto">
                                        <Bot className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="px-4 py-3 bg-card border border-border rounded-2xl rounded-bl-sm shadow-sm flex gap-1 items-center">
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                        <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-card border-t border-border">
                        <form onSubmit={handleSend} className="flex gap-2 items-center bg-muted/50 p-1.5 rounded-full border border-border/50 focus-within:border-primary/50 focus-within:bg-background transition-colors">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder="Escribe tu mensaje..."
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 placeholder:text-muted-foreground/70"
                                disabled={isTyping}
                            />
                            <button 
                                type="submit" 
                                disabled={!input.trim() || isTyping}
                                className="w-9 h-9 flex items-center justify-center bg-primary text-primary-foreground rounded-full disabled:opacity-50 hover:bg-primary/90 transition-colors"
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </button>
                        </form>
                    </div>
                    
                    <div className="bg-muted text-center py-1.5 text-[10px] text-muted-foreground/70 flex items-center justify-center gap-1">
                        Desarrollado por JCAR AI
                    </div>
                </div>
            )}
        </div>
    );
}
