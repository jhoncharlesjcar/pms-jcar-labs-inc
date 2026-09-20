// supabase/functions/_shared/channel-auth.ts
// Autenticación de canales externos (WhatsApp, Instagram, etc.)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.44.0';
import { base64Url, base64UrlDecode, constantTimeEqual, hmac } from './crypto.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

export interface ChannelCredential {
  connection_id: string;
  hotel_id: string;
  channel: string;
  external_account_id: string;
  encrypted_secret: string;
  enabled: boolean;
  status: string;
}

export async function authenticateChannelRequest(supabase: any, req: Request, rawBody: string): Promise<ChannelCredential | null> {
  const credentialId = req.headers.get('x-jcar-key-id')?.trim() || '';
  const timestampText = req.headers.get('x-jcar-timestamp')?.trim() || '';
  const nonce = req.headers.get('x-jcar-nonce')?.trim() || '';
  const signature = req.headers.get('x-jcar-signature')?.trim() || '';
  
  if (!credentialId || !/^\d{10}$/.test(timestampText) || !/^[A-Za-z0-9_-]{16,200}$/.test(nonce) || !signature) return null;
  
  const timestamp = Number(timestampText);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 240) return null;

  const { data: credential, error } = await supabase.rpc('ai_get_channel_credential', {
    p_credential_id: credentialId,
  });
  if (error || !credential) return null;

  let secret: string;
  try {
    const { decryptCredential } = await import('./credentials.ts');
    secret = await decryptCredential(String(credential.encrypted_secret || ''));
  } catch {
    return null;
  }

  const expected = await hmac(`${timestampText}.${nonce}.${rawBody}`, secret);
  if (!constantTimeEqual(expected, signature)) return null;

  const { error: nonceError } = await supabase.rpc('ai_consume_channel_nonce', {
    p_credential_id: credentialId,
    p_nonce: nonce,
    p_expires_at: new Date((timestamp + 300) * 1000).toISOString(),
  });
  if (nonceError) return null;

  return {
    connection_id: credential.connection_id,
    hotel_id: credential.hotel_id,
    channel: credential.channel,
    external_account_id: credential.external_account_id,
    encrypted_secret: credential.encrypted_secret,
    enabled: credential.enabled,
    status: credential.status,
  };
}