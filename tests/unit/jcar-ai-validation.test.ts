import { describe, it, expect } from 'vitest';
import { AIConfigSchema, ChannelFormSchema } from '@/pages/JcarAI/validation';

const validConfig = {
  agent_enabled: true,
  agent_name: 'Lucía',
  agent_personality: 'Amable y profesional',
  welcome_message: 'Hola, ¿en qué te ayudo?',
  handoff_message: 'Te paso con recepción',
  response_delay_seconds: 2,
  quote_validity_minutes: 30,
  hold_minutes: 15,
  deposit_type: 'percentage' as const,
  deposit_value: 50,
  max_discount_percent: 10,
  abandoned_followup_minutes: 60,
};

describe('JCAR AI — AIConfigSchema', () => {
  it('acepta una configuración válida', () => {
    const result = AIConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('rechaza nombre vacío', () => {
    const result = AIConfigSchema.safeParse({ ...validConfig, agent_name: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'agent_name')).toBe(true);
    }
  });

  it('rechaza hold mayor que la vigencia de cotización', () => {
    const result = AIConfigSchema.safeParse({
      ...validConfig,
      quote_validity_minutes: 10,
      hold_minutes: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'hold_minutes')).toBe(true);
    }
  });

  it('rechaza adelanto porcentual mayor a 100', () => {
    const result = AIConfigSchema.safeParse({
      ...validConfig,
      deposit_type: 'percentage',
      deposit_value: 150,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === 'deposit_value')).toBe(true);
    }
  });
});

describe('JCAR AI — ChannelFormSchema', () => {
  it('permite activar el canal web sin ID de cuenta', () => {
    const result = ChannelFormSchema.safeParse({
      channelId: 'web',
      enabled: true,
      external_account_id: '',
      response_delay_seconds: 0,
      max_concurrent_messages: 1,
    });
    expect(result.success).toBe(true);
  });

  it('bloquea activar WhatsApp sin ID de cuenta', () => {
    const result = ChannelFormSchema.safeParse({
      channelId: 'whatsapp',
      enabled: true,
      external_account_id: '',
      response_delay_seconds: 0,
      max_concurrent_messages: 1,
      connectionStatus: 'connected',
    });
    expect(result.success).toBe(false);
  });

  it('bloquea activar WhatsApp si la prueba de conexión no es connected', () => {
    const result = ChannelFormSchema.safeParse({
      channelId: 'whatsapp',
      enabled: true,
      external_account_id: 'acc-1',
      response_delay_seconds: 0,
      max_concurrent_messages: 1,
      connectionStatus: 'disconnected',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza delay fuera de rango', () => {
    const result = ChannelFormSchema.safeParse({
      channelId: 'web',
      enabled: false,
      external_account_id: '',
      response_delay_seconds: 200,
      max_concurrent_messages: 1,
    });
    expect(result.success).toBe(false);
  });
});
