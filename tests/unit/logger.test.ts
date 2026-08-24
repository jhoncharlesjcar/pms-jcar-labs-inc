import { describe, expect, it, vi } from 'vitest';
import { emit, sanitize } from '@/lib/logger';

describe('structured telemetry', () => {
  it('redacts PII and credentials recursively', () => {
    const result = sanitize({
      email: 'persona@example.com',
      nested: {
        authorization: 'Bearer secret',
        note: 'Contactar persona@example.com con documento 12345678',
      },
    });

    expect(result.email).toBe('[REDACTED]');
    expect(result.nested.authorization).toBe('[REDACTED]');
    expect(result.nested.note).not.toContain('persona@example.com');
    expect(result.nested.note).not.toContain('12345678');
  });

  it('emits a correlation id and release metadata', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const record = emit('error', 'test.failure', { token: 'never-log-this' });

    expect(record).toMatchObject({ level: 'error', event: 'test.failure' });
    expect(record.correlation_id).toBeTruthy();
    expect(record.details.token).toBe('[REDACTED]');
    consoleSpy.mockRestore();
  });
});
