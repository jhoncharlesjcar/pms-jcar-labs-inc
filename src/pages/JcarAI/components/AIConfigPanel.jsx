import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AIService } from '@/services/ai.service';
import { AIConfigSchema, issuesToMap } from '@/pages/JcarAI/validation';

const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

/** @typedef {import('@/types/ai.types').AIHotelConfig} AIHotelConfig */

export default function AIConfigPanel({ hotelId }) {
    const queryClient = useQueryClient();
    /** @type {Partial<AIHotelConfig>} */
    const [draft, setDraft] = useState({});
    /** @type {Record<string, string>} */
    const [errors, setErrors] = useState({});
    const { data: config, isLoading, isError, error } = useQuery({
        queryKey: ['ai-config', hotelId],
        queryFn: () => AIService.getConfig(hotelId),
        enabled: Boolean(hotelId),
    });

    useEffect(() => {
        if (config) setDraft({ ...config });
        else setDraft({});
    }, [hotelId, config]);

    const setField = (name, value) => setDraft((current) => ({ ...current, [name]: value }));

    const validateForm = () => {
        const rawData = {
            agent_enabled: Boolean(draft.agent_enabled),
            agent_name: draft.agent_name || '',
            agent_personality: draft.agent_personality || '',
            welcome_message: draft.welcome_message || '',
            handoff_message: draft.handoff_message || '',
            response_delay_seconds: Number(draft.response_delay_seconds || 0),
            quote_validity_minutes: Number(draft.quote_validity_minutes || 30),
            hold_minutes: Number(draft.hold_minutes || 15),
            deposit_type: draft.deposit_type || 'full',
            deposit_value: Number(draft.deposit_value ?? 100),
            max_discount_percent: Number(draft.max_discount_percent || 0),
            abandoned_followup_minutes: Number(draft.abandoned_followup_minutes || 60),
        };

        const result = AIConfigSchema.safeParse(rawData);
        if (!result.success) {
            setErrors(issuesToMap(result.error));
            return null;
        }
        setErrors({});
        return result.data;
    };

    const updateMutation = useMutation({
        /** @param {Partial<AIHotelConfig>} updates */
        mutationFn: (updates) => AIService.updateConfig(hotelId, updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['ai-config', hotelId] });
            toast.success('Configuración actualizada correctamente');
        },
        onError: (mutationError) => toast.error(mutationError?.message || 'No se pudo actualizar la configuración'),
    });

    const handleSubmit = (event) => {
        event.preventDefault();
        const validData = validateForm();
        if (!validData) {
            toast.error('Corrige los errores antes de guardar');
            return;
        }
        updateMutation.mutate(validData);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Cargando configuración…</div>;
    if (isError) {
        return (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">
                No se pudo cargar la configuración de este hotel: {error?.message}
            </div>
        );
    }

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
                            checked={Boolean(draft.agent_enabled)}
                            onChange={(event) => {
                                setField('agent_enabled', event.target.checked);
                                updateMutation.mutate({ agent_enabled: event.target.checked });
                            }}
                        />
                        <span className="h-7 w-14 rounded-full bg-muted after:absolute after:left-[2px] after:top-[2px] after:h-6 after:w-6 after:rounded-full after:border after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-full" />
                    </label>
                </div>

                <form key={`${hotelId}:${config?.updated_at || 'new'}`} onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
                    <section className="space-y-4">
                        <h3 className="text-lg font-semibold">Personalidad y mensajes</h3>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <label className="space-y-2 text-sm font-medium">Nombre del agente
                                <input name="agent_name" value={draft.agent_name || ''} onChange={(e) => setField('agent_name', e.target.value)} className={errors.agent_name ? `${inputClass} border-destructive` : inputClass} placeholder="Ej. Lucía" />
                                {errors.agent_name && <p className="text-xs text-destructive">{errors.agent_name}</p>}
                            </label>
                            <label className="space-y-2 text-sm font-medium">Tono y personalidad
                                <input name="agent_personality" value={draft.agent_personality || ''} onChange={(e) => setField('agent_personality', e.target.value)} className={errors.agent_personality ? `${inputClass} border-destructive` : inputClass} placeholder="Amable, profesional y persuasiva" />
                                {errors.agent_personality && <p className="text-xs text-destructive">{errors.agent_personality}</p>}
                            </label>
                        </div>
                        <label className="block space-y-2 text-sm font-medium">Mensaje de bienvenida
                            <textarea name="welcome_message" value={draft.welcome_message || ''} onChange={(e) => setField('welcome_message', e.target.value)} rows={2} className={`${inputClass} ${errors.welcome_message ? 'border-destructive' : ''}`} />
                            {errors.welcome_message && <p className="text-xs text-destructive">{errors.welcome_message}</p>}
                        </label>
                        <label className="block space-y-2 text-sm font-medium">Mensaje de transferencia
                            <textarea name="handoff_message" value={draft.handoff_message || ''} onChange={(e) => setField('handoff_message', e.target.value)} rows={2} className={`${inputClass} ${errors.handoff_message ? 'border-destructive' : ''}`} />
                            {errors.handoff_message && <p className="text-xs text-destructive">{errors.handoff_message}</p>}
                        </label>
                        <label className="block space-y-2 text-sm font-medium">Ritmo de respuesta del canal
                            <div className="flex items-center gap-3">
                                <input name="response_delay_seconds" type="number" min="0" max="30" value={draft.response_delay_seconds ?? 0} onChange={(e) => setField('response_delay_seconds', e.target.value)} className="w-24 rounded-md border border-input bg-background px-3 py-2" />
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
                            <NumberField name="quote_validity_minutes" label="Vigencia de cotización" suffix="minutos" min="5" max="1440" value={draft.quote_validity_minutes ?? 30} onChange={(e) => setField('quote_validity_minutes', e.target.value)} error={errors.quote_validity_minutes} />
                            <NumberField name="hold_minutes" label="Duración del hold" suffix="minutos" min="5" max="120" value={draft.hold_minutes ?? 15} onChange={(e) => setField('hold_minutes', e.target.value)} error={errors.hold_minutes} />
                            <label className="space-y-2 text-sm font-medium">Tipo de adelanto
                                <select name="deposit_type" value={draft.deposit_type || 'full'} onChange={(e) => setField('deposit_type', e.target.value)} className={inputClass}>
                                    <option value="full">Pago completo</option>
                                    <option value="percentage">Porcentaje</option>
                                    <option value="fixed">Monto fijo</option>
                                </select>
                            </label>
                            <NumberField name="deposit_value" label="Valor del adelanto" suffix="% o S/" min="0" step="0.01" value={draft.deposit_value ?? 100} onChange={(e) => setField('deposit_value', e.target.value)} error={errors.deposit_value} />
                            <NumberField name="max_discount_percent" label="Descuento máximo" suffix="%" min="0" max="100" step="0.1" value={draft.max_discount_percent ?? 0} onChange={(e) => setField('max_discount_percent', e.target.value)} error={errors.max_discount_percent} />
                            <NumberField name="abandoned_followup_minutes" label="Seguimiento de abandono" suffix="minutos" min="5" max="10080" value={draft.abandoned_followup_minutes ?? 60} onChange={(e) => setField('abandoned_followup_minutes', e.target.value)} error={errors.abandoned_followup_minutes} />
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

function NumberField({ name, label, suffix, value, error, ...inputProps }) {
    return (
        <label className="space-y-2 text-sm font-medium">
            {label}
            <input name={name} type="number" value={value} className={error ? `${inputClass} border-destructive` : inputClass} {...inputProps} />
            {error ? <span className="block text-xs font-normal text-destructive">{error}</span> : <span className="block text-xs font-normal text-muted-foreground">{suffix}</span>}
        </label>
    );
}
