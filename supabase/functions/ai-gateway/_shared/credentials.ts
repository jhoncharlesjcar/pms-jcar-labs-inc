// supabase/functions/ai-gateway/_shared/credentials.ts
// Gestión de credenciales de canal (encriptación/desencriptación)

import { base64Url, base64UrlDecode, ownedArrayBuffer } from './crypto.ts';

declare const Deno: any;

async function credentialMasterKey(): Promise<CryptoKey> {
  const encoded = Deno.env.get('CHANNEL_CREDENTIAL_MASTER_KEY') || '';
  let bytes: Uint8Array;
  try {
    bytes = base64UrlDecode(encoded);
  } catch {
    throw new Error('channel_credential_master_key_invalid');
  }
  if (bytes.byteLength !== 32) throw new Error('channel_credential_master_key_invalid');
  return await crypto.subtle.importKey('raw', ownedArrayBuffer(bytes), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptCredential(secret: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ownedArrayBuffer(iv) }, await credentialMasterKey(), new TextEncoder().encode(secret),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptCredential(value: string): Promise<string> {
  const [version, ivPart, cipherPart, ...rest] = value.split('.');
  if (version !== 'v1' || !ivPart || !cipherPart || rest.length) throw new Error('channel_credential_ciphertext_invalid');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ownedArrayBuffer(base64UrlDecode(ivPart)) },
    await credentialMasterKey(),
    ownedArrayBuffer(base64UrlDecode(cipherPart)),
  );
  return new TextDecoder().decode(plaintext);
}