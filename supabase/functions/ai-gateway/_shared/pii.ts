// supabase/functions/ai-gateway/_shared/pii.ts
// Protección de PII (Información Personal Identificable)

const sensitiveKeys = new Set([
  'guest_name', 'guest_phone', 'guest_email', 'guest_document', 'guest_document_type',
  'huesped_nombre', 'huesped_telefono', 'huesped_email', 'huesped_dni',
  'portal_token', 'checkin_token', 'token_hash', 'provider_reference',
]);

export function redactPII(value: string): string {
  return value
    .replace(/\b(me llamo|mi nombre es|nombre\s*[:=])\s+([\p{L}][\p{L}' -]{2,100})/giu, '$1 [nombre protegido]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo protegido]')
    .replace(/(?<!\d)\+?\d[\d\s()-]{5,18}\d(?!\d)/g, '[dato numérico protegido]');
}

export function protectCurrentPII(value: string, journeyStage?: string): { text: string; vault: Record<string, string> } {
  const vault: Record<string, string> = {};
  let sequence = 0;
  const store = (kind: string, raw: string): string => {
    const token = `[PII_${kind}_${++sequence}]`;
    vault[token] = raw.trim();
    return token;
  };
  let text = value;
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (match) => store('EMAIL', match));
  text = text.replace(/\b(me llamo|mi nombre es|nombre\s*[:=])\s+([\p{L}][\p{L}' -]{2,100})/giu,
    (_match, label, name) => `${label} ${store('GUEST_NAME', name)}`);
  text = text.replace(/\b(DNI|CE|carn[eé] de extranjer[ií]a|pasaporte|documento)\s*[:=#-]?\s*([A-Z0-9-]{4,20})\b/giu,
    (_match, label, document) => `${label}: ${store('DOCUMENT', document)}`);
  text = text.replace(/\b(tel[eé]fono|celular|whatsapp)\s*[:=#-]?\s*(\+?\d[\d\s()-]{5,18}\d)\b/giu,
    (_match, label, phone) => `${label}: ${store('PHONE', phone)}`);
  if (journeyStage === 'guest_data_pending' && /^[\p{L}][\p{L}' -]{2,100}$/u.test(text.trim())) {
    text = store('GUEST_NAME', text);
  }
  text = text.replace(/(?<!\d)\+?\d[\d\s()-]{5,18}\d(?!\d)/g, (match) => store('NUMBER', match));
  return { text, vault };
}

export function sanitizeForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForModel);
  if (!value || typeof value !== 'object') return typeof value === 'string' ? redactPII(value) : value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()))
      .map(([key, child]) => [key, sanitizeForModel(child)])
  );
}

export function matchesEvidenceMime(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mimeType === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (mimeType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  return false;
}