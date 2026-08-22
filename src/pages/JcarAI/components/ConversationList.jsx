import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, User, Phone, CalendarCheck, Clock, ExternalLink } from 'lucide-react';
import ConversationDetail from './ConversationDetail.jsx';

export default function ConversationList({ hotelId }) {
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedConvId, setSelectedConvId] = useState(null);

    const { data: conversations, isLoading } = useQuery({
        queryKey: ['ai-conversations', hotelId, statusFilter],
        queryFn: () => AIService.getConversations(hotelId, statusFilter),
        refetchInterval: 10000 // Polling cada 10s
    });

    const getStatusBadge = (status) => {
        const variants = {
            active: 'bg-blue-500/10 text-blue-500',
            quoted: 'bg-amber-500/10 text-amber-500',
            booked: 'bg-emerald-500/10 text-emerald-500',
            handed_off: 'bg-purple-500/10 text-purple-500',
            abandoned: 'bg-slate-500/10 text-slate-500',
            closed: 'bg-slate-500/10 text-slate-500',
        };
        const labels = {
            active: 'En curso',
            quoted: 'Cotizado',
            booked: 'Reservado',
            handed_off: 'Handoff',
            abandoned: 'Abandonado',
            closed: 'Cerrado'
        };
        return <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[status] || 'bg-gray-100'}`}>{labels[status] || status}</span>;
    };

    if (selectedConvId) {
        return (
            <ConversationDetail 
                conversationId={selectedConvId} 
                onBack={() => setSelectedConvId(null)} 
            />
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex space-x-2 w-full overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
                    {['all', 'active', 'quoted', 'booked', 'handed_off'].map(filter => (
                        <button
                            key={filter}
                            onClick={() => setStatusFilter(filter)}
                            className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap
                                ${statusFilter === filter 
                                    ? 'bg-primary text-primary-foreground shadow-sm' 
                                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                        >
                            {filter === 'all' ? 'Todas' 
                                : filter === 'active' ? 'Activas'
                                : filter === 'quoted' ? 'Con Cotización'
                                : filter === 'booked' ? 'Reservas'
                                : 'Transferidas'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-card/50 border border-border/50 rounded-xl overflow-hidden shadow-sm">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Cargando conversaciones...</div>
                ) : !conversations || conversations.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
                        <Bot className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No hay conversaciones</p>
                        <p className="text-sm">El agente está esperando interactuar con los huéspedes.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {conversations.map(conv => (
                            <div 
                                key={conv.id} 
                                onClick={() => setSelectedConvId(conv.id)}
                                className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                        <User className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-foreground">
                                                {conv.guest_name || 'Huésped Anónimo'}
                                            </h3>
                                            {getStatusBadge(conv.status)}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                                            {conv.guest_phone && (
                                                <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {conv.guest_phone}</span>
                                            )}
                                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Actualizado {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true, locale: es })}</span>
                                            <span className="flex items-center gap-1 opacity-60">ID: {conv.session_id.substring(0, 8)}...</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 self-end sm:self-auto">
                                    {conv.reserva_id && (
                                        <div className="flex items-center gap-1 text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-1 rounded text-xs font-medium">
                                            <CalendarCheck className="w-3 h-3" /> Reserva creada
                                        </div>
                                    )}
                                    <button className="p-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-all">
                                        <ExternalLink className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
