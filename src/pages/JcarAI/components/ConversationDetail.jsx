import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowLeft, Bot, User, Wrench } from 'lucide-react';

export default function ConversationDetail({ conversationId, onBack }) {
    const { data: messages, isLoading } = useQuery({
        queryKey: ['ai-messages', conversationId],
        queryFn: () => AIService.getMessages(conversationId),
        refetchInterval: 5000 // Polling cada 5s para tiempo real (en V2 usar webhooks/realtime)
    });

    return (
        <div className="flex flex-col h-[600px] border border-border/60 rounded-xl overflow-hidden bg-card/30">
            <div className="p-4 border-b border-border bg-muted/20 flex items-center gap-4">
                <button 
                    onClick={onBack}
                    className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h3 className="font-semibold text-foreground">Detalle de Conversación</h3>
                    <p className="text-xs text-muted-foreground">ID: {conversationId}</p>
                </div>
                
                {/* Botón Handoff (V2) */}
                <div className="ml-auto">
                    <button 
                        className="text-xs font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        onClick={() => alert("Asumir control manual disponible en próxima actualización")}
                    >
                        Tomar Control Manual
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {isLoading ? (
                    <div className="text-center p-8 text-muted-foreground">Cargando mensajes...</div>
                ) : !messages?.length ? (
                    <div className="text-center p-8 text-muted-foreground">No hay mensajes.</div>
                ) : (
                    <div className="space-y-6">
                        {messages.map((msg) => {
                            const isUser = msg.role === 'user';
                            const isTool = msg.role === 'tool';
                            const isSystem = msg.role === 'system';

                            if (isSystem) return null; // Ocultamos prompts de sistema

                            if (isTool) {
                                return (
                                    <div key={msg.id} className="flex justify-center my-4">
                                        <div className="bg-muted/50 border border-border/50 text-xs px-3 py-1.5 rounded-full flex items-center gap-2 text-muted-foreground">
                                            <Wrench className="w-3 h-3" />
                                            <span>El agente ejecutó <strong className="font-mono">{msg.tool_name}</strong></span>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>
                                    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                                        <div className={`px-4 py-2.5 rounded-2xl whitespace-pre-wrap text-sm ${
                                            isUser 
                                                ? 'bg-primary text-primary-foreground rounded-tr-none shadow-sm' 
                                                : 'bg-card border border-border rounded-tl-none shadow-sm text-foreground'
                                        }`}>
                                            {msg.content}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground px-1">
                                            {format(new Date(msg.created_at), "HH:mm", { locale: es })}
                                        </span>
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
