import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const gateway = readFileSync(
  resolve(process.cwd(), 'supabase/functions/ai-gateway/index.ts'),
  'utf8',
);

describe('ai-gateway action contract', () => {
  it('accepts the staff/widget body actions instead of a path router', () => {
    expect(gateway).toContain("body.action === 'bootstrap'");
    expect(gateway).toContain("body.action === 'channel_healthcheck'");
    expect(gateway).toContain("body.action === 'provision_channel_credential'");
    expect(gateway).toContain("body.action || 'message'");
    expect(gateway).not.toContain('serve(serve)');
    expect(gateway).not.toContain("pattern: /^\\/bootstrap$/");
  });
});
