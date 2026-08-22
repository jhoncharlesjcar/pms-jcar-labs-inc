import React, { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AIService } from '@/services/ai.service';
import { Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AIConfigPanel({ hotelId }) {
    const queryClient = useQueryClient();

    const { data: config, isLoading } = useQuery({
        queryKey: ['ai-config', hotelId],
        queryFn: () => AIService.getConfig(hotelId)
    });

    const updateMutation = useMutation({
        mutationFn: (updates) => AIService.updateConfig(hotelId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries(['ai-config', hotelId]);
            toast.success("Configuración actualizada correctamente");
        }
    });

    const handleToggle = (field, value) => {
        updateMutation.mutate({ [field]: value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        updateMutation.mutate({
            agent_name: formData.get('agent_name'),
            agent_personality: formData.get('agent_personality'),
            welcome_message: formData.get('welcome_message'),
            handoff_message: formData.get('handoff_message'),
            response_delay_seconds: parseInt(formData.get('response_delay_seconds') || 0, 10),
        });
    };

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Cargando configuración...</div>;
    }

    const isEnabled = config?.agent_enabled;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                
                {/* Master Switch */}
                <div className={`p-6 rounded-xl border ${isEnabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'} flex items-center justify-between transition-colors`}>
                    <div>
                        <h3 className="text-lg font-semibold text-foreground">Estado del Agente IA</h3>
                        <p className="text-sm text-muted-foreground mt-1">Activa o desactiva el widget de chat en la página de reservas.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={isEnabled} onChange={(e) => handleToggle('agent_enabled', e.target.checked)} />
                        <div className="w-14 h-7 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                </div>

                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Personalidad y Textos</h3>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Nombre del Agente</label>
                                <input name="agent_name" defaultValue={config?.agent_name} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm" placeholder="Ej: Lucía" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Tono y Personalidad</label>
                                <input name="agent_personality" defaultValue={config?.agent_personality} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm" placeholder="Ej: formal y directo" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Mensaje de Bienvenida</label>
                            <textarea name="welcome_message" defaultValue={config?.welcome_message} rows={2} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm" />
                            <p className="text-xs text-muted-foreground">Este es el primer mensaje que envía el agente cuando el usuario abre el chat.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Mensaje de Transferencia (Handoff)</label>
                            <textarea name="handoff_message" defaultValue={config?.handoff_message} rows={2} className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm" />
                            <p className="text-xs text-muted-foreground">Se envía cuando la IA no puede resolver la duda y necesita un humano.</p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <label className="text-sm font-semibold text-amber-500">Retraso de Respuesta (Anti-Ban WhatsApp)</label>
                            <div className="flex items-center gap-3">
                                <input name="response_delay_seconds" type="number" min="0" max="30" defaultValue={config?.response_delay_seconds || 0} className="w-24 px-3 py-2 bg-background border border-input rounded-md text-sm" />
                                <span className="text-sm">segundos</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Configura los segundos que tardará el bot en responder. Ideal para evadir bloqueos en WhatsApp no oficial (recomendado: 3 a 5 seg).</p>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-end">
                            <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                                {updateMutation.isPending ? 'Guardando...' : <><Save className="w-4 h-4"/> Guardar Textos</>}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-card border border-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-4">Ajustes del Modelo</h3>
                    
                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-2 border-b border-border pb-4">
                            <div>
                                <p className="font-semibold text-sm">Handoff 24/7</p>
                                <p className="text-xs text-muted-foreground mt-0.5">La IA registra consultas fuera de horario como pendientes para el staff.</p>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-xs font-bold rounded">Activo</div>
                        </div>

                        <div className="flex items-start justify-between gap-2 border-b border-border pb-4">
                            <div>
                                <p className="font-semibold text-sm">Idioma Bilingüe</p>
                                <p className="text-xs text-muted-foreground mt-0.5">El agente detecta automáticamente inglés o español nativo con Gemini.</p>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-500 px-2 py-0.5 text-xs font-bold rounded">Activo</div>
                        </div>
                        
                        <div className="p-4 bg-blue-500/10 rounded-lg flex gap-3 text-blue-700 dark:text-blue-400 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <div>
                                <p className="font-semibold mb-1">Modelo Actual: Gemini 2.0 Flash</p>
                                <p className="opacity-80">El agente usa function calling avanzado para consultar precios y crear reservas en tiempo real.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
