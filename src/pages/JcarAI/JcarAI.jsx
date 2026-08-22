import React, { useState } from 'react';
import { Bot, MessageSquare, BookOpen, Settings as SettingsIcon, BarChart3 } from 'lucide-react';
import { useHotelData } from '@/hooks/useHotelData';
import PageSkeleton from '@/components/loaders/PageSkeleton';

// Componentes
import AIDashboard from './components/AIDashboard.jsx';
import ConversationList from './components/ConversationList.jsx';
import KnowledgeManager from './components/KnowledgeManager.jsx';
import AIConfigPanel from './components/AIConfigPanel.jsx';

const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'conversations', label: 'Conversaciones', icon: MessageSquare },
    { id: 'knowledge', label: 'Conocimiento', icon: BookOpen },
    { id: 'config', label: 'Configuración', icon: SettingsIcon },
];

export default function JcarAI() {
    const { hotelId, isLoading } = useHotelData();
    const [activeTab, setActiveTab] = useState('dashboard');

    if (isLoading) {
        return <PageSkeleton variant="dashboard" />;
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Bot className="w-4 h-4" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Módulo IA</span>
                    </div>
                    <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                        JCAR AI Sales Agent
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                        Gestiona tu asistente virtual: supervisa conversaciones, entrena su base de conocimiento y configura sus capacidades de venta automática.
                    </p>
                </div>
            </header>

            <div className="border-b border-border">
                <div className="flex space-x-8 overflow-x-auto custom-scrollbar pb-[-1px]">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-2 py-3 px-1 text-sm font-semibold whitespace-nowrap
                                    border-b-2 transition-colors
                                    ${isActive 
                                        ? 'border-primary text-primary' 
                                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-6">
                {activeTab === 'dashboard' && <AIDashboard hotelId={hotelId} />}
                {activeTab === 'conversations' && <ConversationList hotelId={hotelId} />}
                {activeTab === 'knowledge' && <KnowledgeManager hotelId={hotelId} />}
                {activeTab === 'config' && <AIConfigPanel hotelId={hotelId} />}
            </div>
        </div>
    );
}
