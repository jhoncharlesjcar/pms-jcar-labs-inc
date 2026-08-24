import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export default function AIConfigPanel({ hotelId }) {
    const queryClient = useQueryClient();
    const { data: config, isLoading } = useQuery({
        queryKey: ['ai-config', hotelId],
        queryFn: () => AIService.getConfig(hotelId),
        enabled: Boolean(hotelId),
    });

    const updateMutation = useMutation({
        mutationFn: (updates) => AIService.updateConfig(hotelId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-config', hotelId] });
            toast.success('Configuración actualizada correctamente');
        },
        onError: (error) => toast.error(error?.message || 'No se pudo actualizar la configuración'),
    });

    const handleSubmit = (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        updateMutation.mutate({
            agent_name: form.get('agent_name')?.toString() || '',
            agent_personality: form.get('agent_personality')?.toString() || '',
            welcome_message: form.get('welcome_message')?.toString() || '',
            handoff_message: form.get('handoff_message')?.toString() || '',
            response_delay_seconds: Number(form.get('response_delay_seconds') || 0),
            quote_validity_minutes: Number(form.get('quote_validity_minutes') || 30),
            hold_minutes: Number(form.get('hold_minutes') || 15),
            deposit_type: form.get('deposit_type')?.toString() || 'full',
            deposit_value: Number(form.get('deposit_value') || 100),
            max_discount_percent: Number(form.get('max_discount_percent') || 0),
            abandoned_followup_minutes: Number(form.get('abandoned_followup_minutes') || 60),
        });
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando configuración…</div>;

    return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
                <div className={`flex items-center justify-between rounded-xl border p-6 ${config?.agent_enabled ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'}`}>
                    <div>
                        <h3 className="text-lg font-semibold">Estado de JcarAI</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Activa el empleado digital multicanal del hotel.</p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                        <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={Boolean(config?.agent_enabled)}
                            onChange={(event) => updateMutation.mutate({ agent_enabled: event.target.checked })}
                        />
                        <span className="h-7 w-14 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:border after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full" />
                    </label>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
                    <section className="space-y-4">
                        <h3 className="text-lg font-semibold">Personalidad y mensajes</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm font-medium">Nombre del agente
                                <input name="agent_name" defaultValue={config?.agent_name} className={inputClass} placeholder="Ej. Lucía" />
                            </label>
                            <label className="space-y-2 text-sm font-medium">Tono y personalidad
                                <input name="agent_personality" defaultValue={config?.agent_personality} className={inputClass} placeholder="Amable, profesional y persuasiva" />
                            </label>
                        </div>
                        <label className="block space-y-2 text-sm font-medium">Mensaje de bienvenida
                            <textarea name="welcome_message" defaultValue={config?.welcome_message} rows={2} className={inputClass} />
                        </label>
                        <label className="block space-y-2 text-sm font-medium">Mensaje de transferencia
                            <textarea name="handoff_message" defaultValue={config?.handoff_message} rows={2} className={inputClass} />
                        </label>
                        <label className="block space-y-2 text-sm font-medium">Ritmo de respuesta del canal
                            <div className="flex items-center gap-3">
                                <input name="response_delay_seconds" type="number" min="0" max="30" defaultValue={config?.response_delay_seconds || 0} className="w-24 rounded-md border border-input bg-background px-3 py-2" />
                                <span className="text-sm text-muted-foreground">segundos</span>
                            </div>
                            <span className="block text-xs font-normal text-muted-foreground">Ordena la cola y ofrece una conversación con ritmo natural.</span>
                        </label>
                    </section>

                    <section className="space-y-4 border-t border-border pt-5">
                        <div>
                            <h3 className="text-lg font-semibold">Reglas comerciales</h3>
                            <p className="text-xs text-muted-foreground">Se aplican en PostgreSQL; el modelo no puede alterarlas.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <NumberField name="quote_validity_minutes" label="Vigencia de cotización" suffix="minutos" min="5" max="1440" value={config?.quote_validity_minutes || 30} />
                            <NumberField name="hold_minutes" label="Duración del hold" suffix="minutos" min="5" max="120" value={config?.hold_minutes || 15} />
                            <label className="space-y-2 text-sm font-medium">Tipo de adelanto
                                <select name="deposit_type" defaultValue={config?.deposit_type || 'full'} className={inputClass}>
                                    <option value="full">Pago completo</option>
                                    <option value="percentage">Porcentaje</option>
                                    <option value="fixed">Monto fijo</option>
                                </select>
                            </label>
                            <NumberField name="deposit_value" label="Valor del adelanto" suffix="% o S/" min="0" step="0.01" value={config?.deposit_value ?? 100} />
                            <NumberField name="max_discount_percent" label="Descuento máximo" suffix="%" min="0" max="100" step="0.1" value={config?.max_discount_percent || 0} />
                            <NumberField name="abandoned_followup_minutes" label="Seguimiento de abandono" suffix="minutos" min="5" max="10080" value={config?.abandoned_followup_minutes || 60} />
                        </div>
                    </section>

                    <div className="flex justify-end border-t border-border pt-4">
                        <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50">
                            <Save className="h-4 w-4" /> {updateMutation.isPending ? 'Guardando…' : 'Guardar configuración'}
                        </button>
                    </div>
                </form>
            </div>

            <aside className="space-y-6">
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="mb-4 text-lg font-semibold">Capacidades activas</h3>
                    <div className="space-y-3 text-sm">
                        {['Ventas y cotización', 'Hold de inventario', 'Pago verificado', 'Recepción posreserva', 'Handoff humano'].map((capability) => (
                            <div key={capability} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                                <span>{capability}</span><span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500">Activo</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-5 flex gap-3 rounded-lg bg-blue-500/10 p-4 text-sm text-blue-700 dark:text-blue-400">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p>Disponibilidad, tarifas, holds y confirmaciones se validan en el PMS.</p>
                    </div>
                </div>
            </aside>
        </div>
    );
}

function NumberField({ name, label, suffix, value, ...inputProps }) {
    return (
        <label className="space-y-2 text-sm font-medium">{label}
            <input name={name} type="number" defaultValue={value} className={inputClass} {...inputProps} />
            <span className="block text-xs font-normal text-muted-foreground">{suffix}</span>
        </label>
    );
}
