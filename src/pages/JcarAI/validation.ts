import { z } from 'zod';

export const AIConfigSchema = z.object({
  agent_enabled: z.boolean(),
  agent_name: z.string().min(1, 'El nombre es requerido').max(100),
  agent_personality: z.string().min(1, 'El tono es requerido').max(500),
  welcome_message: z.string().min(1, 'El mensaje de bienvenida es requerido').max(2000),
  handoff_message: z.string().min(1, 'El mensaje de transferencia es requerido').max(1000),
  response_delay_seconds: z.number().min(0).max(30),
  quote_validity_minutes: z.number().min(5).max(1440),
  hold_minutes: z.number().min(5).max(120),
  deposit_type: z.enum(['full', 'percentage', 'fixed']),
  deposit_value: z.number().min(0),
  max_discount_percent: z.number().min(0).max(100),
  abandoned_followup_minutes: z.number().min(5).max(10080),
}).superRefine((data, ctx) => {
  if (data.hold_minutes > data.quote_validity_minutes) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['hold_minutes'],
      message: 'El hold no puede durar más que la vigencia de la cotización',
    });
  }
  if (data.deposit_type === 'percentage' && data.deposit_value > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['deposit_value'],
      message: 'El porcentaje de adelanto no puede superar 100',
    });
  }
});

export const ChannelFormSchema = z.object({
  channelId: z.enum(['whatsapp', 'instagram', 'facebook', 'web']),
  enabled: z.boolean(),
  external_account_id: z.string(),
  response_delay_seconds: z.number().int().min(0).max(120),
  max_concurrent_messages: z.number().int().min(1).max(50),
  connectionStatus: z.enum(['connected', 'degraded', 'disconnected', 'paused']).optional(),
}).superRefine((data, ctx) => {
  if (data.enabled && data.channelId !== 'web' && !data.external_account_id.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['external_account_id'],
      message: 'Ingresa el ID de cuenta antes de activar el canal',
    });
  }
  if (data.enabled && data.channelId !== 'web' && data.connectionStatus !== 'connected') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enabled'],
      message: 'Ejecuta una prueba de conexión satisfactoria antes de activar el canal',
    });
  }
});

export function issuesToMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    map[issue.path.join('.')] = issue.message;
  }
  return map;
}
