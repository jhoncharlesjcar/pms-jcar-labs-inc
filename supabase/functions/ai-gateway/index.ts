import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";
import { AIGatewayRequest } from "./types.ts";
import { buildSystemPrompt } from "./prompts.ts";
import { geminiToolsDefinition, ToolExecutor } from "./tools.ts";
import { callGemini, submitToolResponseToGemini } from "./gemini.ts";

declare const Deno: any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

async function hmac(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return base64Url(new Uint8Array(signature));
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

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

async function encryptCredential(secret: string): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ownedArrayBuffer(iv) }, await credentialMasterKey(), new TextEncoder().encode(secret),
  );
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

async function decryptCredential(value: string): Promise<string> {
  const [version, ivPart, cipherPart, ...rest] = value.split('.');
  if (version !== 'v1' || !ivPart || !cipherPart || rest.length) throw new Error('channel_credential_ciphertext_invalid');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ownedArrayBuffer(base64UrlDecode(ivPart)) },
    await credentialMasterKey(),
    ownedArrayBuffer(base64UrlDecode(cipherPart)),
  );
  return new TextDecoder().decode(plaintext);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ownedArrayBuffer(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function matchesEvidenceMime(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  if (mimeType === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (mimeType === 'application/pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index++) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

function jsonResponse(body: unknown, status = 200): Response {
  return noStoreJson(body, status, corsHeaders);
}

async function authenticateChannelRequest(supabase: any, req: Request, rawBody: string): Promise<any> {
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
  return credential;
}

const sensitiveKeys = new Set([
  'guest_name', 'guest_phone', 'guest_email', 'guest_document', 'guest_document_type',
  'huesped_nombre', 'huesped_telefono', 'huesped_email', 'huesped_dni',
  'portal_token', 'checkin_token', 'token_hash', 'provider_reference',
]);

function redactPII(value: string): string {
  return value
    .replace(/\b(me llamo|mi nombre es|nombre\s*[:=])\s+([\p{L}][\p{L}' -]{2,100})/giu, '$1 [nombre protegido]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo protegido]')
    .replace(/(?<!\d)\+?\d[\d\s()-]{5,18}\d(?!\d)/g, '[dato numérico protegido]');
}

function protectCurrentPII(value: string, journeyStage?: string): { text: string; vault: Record<string, string> } {
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

function sanitizeForModel(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeForModel);
  if (!value || typeof value !== 'object') return typeof value === 'string' ? redactPII(value) : value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !sensitiveKeys.has(key.toLowerCase()))
      .map(([key, child]) => [key, sanitizeForModel(child)])
  );
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = requestId(req);
  try {
    const rawBody = await req.text();
    let body: AIGatewayRequest;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (body.action === 'provision_channel_credential') {
      const auth = await authenticateRequest(req);
      if (auth.error || !auth.user) return errorResponse(auth.error || 'Unauthorized', auth.status);
      if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse('Administrator role required', 403);
      const connectionId = String(body.connection_id || '');
      if (!uuidPattern.test(connectionId)) return errorResponse('Invalid connection_id', 400);
      const { data: connection, error: connectionError } = await supabase.from('ai_channel_connections')
        .select('id,hotel_id,channel,credential_version').eq('id', connectionId).single();
      if (connectionError || !connection) return errorResponse('Channel connection not found', 404);
      if (connection.channel === 'web') return errorResponse('Web channel does not use connector credentials', 422);
      if (auth.user.role !== 'developer' && auth.user.hotel_id !== connection.hotel_id) {
        return errorResponse('Cross-tenant credential provisioning denied', 403);
      }
      const credentialId = `jcar_${randomBase64Url(18)}`;
      const secret = randomBase64Url(32);
      const credentialVersion = Number(connection.credential_version || 0) + 1;
      const encryptedSecret = await encryptCredential(secret);
      const { error: storeError } = await supabase.rpc('ai_store_channel_credential', {
        p_connection_id: connection.id,
        p_credential_id: credentialId,
        p_encrypted_secret: encryptedSecret,
        p_version: credentialVersion,
      });
      if (storeError) throw storeError;
      await supabase.from('ai_channel_connections').update({
        enabled: false, status: 'disconnected', last_error: null, updated_at: new Date().toISOString(),
      }).eq('id', connection.id).eq('hotel_id', connection.hotel_id);
      logEvent('info', 'channel_credential_provisioned', {
        request_id: traceId, connection_id: connection.id, hotel_id: connection.hotel_id,
        credential_version: credentialVersion,
      });
      return jsonResponse({
        credential_id: credentialId,
        secret,
        credential_version: credentialVersion,
        signature_contract: 'base64url(HMAC-SHA256(secret, timestamp.nonce.rawBody))',
      }, 201);
    }

    if (body.action === 'channel_healthcheck') {
      const signedCredential = await authenticateChannelRequest(supabase, req, rawBody);
      if (signedCredential) {
        const { error: updateError } = await supabase.from('ai_channel_connections').update({
          status: 'connected', last_healthcheck_at: new Date().toISOString(), last_error: null,
          updated_at: new Date().toISOString(),
        }).eq('id', signedCredential.connection_id).eq('hotel_id', signedCredential.hotel_id);
        if (updateError) throw updateError;
        return jsonResponse({ success: true, status: 'connected', request_id: traceId });
      }
      const auth = await authenticateRequest(req);
      if (auth.error || !auth.user) return errorResponse('A signed connector healthcheck or administrator session is required', 401);
      if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse('Administrator role required', 403);
      const connectionId = String(body.connection_id || '');
      if (!uuidPattern.test(connectionId)) return errorResponse('Invalid connection_id', 400);
      const { data: connection, error: connectionError } = await supabase.from('ai_channel_connections')
        .select('id,hotel_id,status,credential_id,last_healthcheck_at,last_error').eq('id', connectionId).single();
      if (connectionError || !connection) return errorResponse('Channel connection not found', 404);
      if (auth.user.role !== 'developer' && auth.user.hotel_id !== connection.hotel_id) return errorResponse('Cross-tenant healthcheck denied', 403);
      const lastSeen = connection.last_healthcheck_at ? new Date(connection.last_healthcheck_at).getTime() : 0;
      if (!connection.credential_id || connection.status !== 'connected' || Date.now() - lastSeen > 10 * 60 * 1000) {
        return jsonResponse({ error: connection.last_error || 'El conector todavía no ha realizado un healthcheck firmado' }, 409);
      }
      return jsonResponse({ success: true, status: connection.status, last_healthcheck_at: connection.last_healthcheck_at });
    }

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const { data: config, error: configError } = await supabase
      .from('ai_hotel_config')
      .select('*')
      .eq('hotel_id', hotelId)
      .single();
    if (configError || !config) return errorResponse('Hotel configuration not found', 404);
    if (body.action === 'bootstrap') {
      const requestedSession = String(body.session_id || '');
      const requestedToken = String(body.session_token || '');
      let validatedSession: any = null;
      if (uuidPattern.test(requestedSession) && requestedToken) {
        const { data } = await supabase.rpc('ai_validate_client_session', {
          p_hotel_id: hotelId,
          p_session_token: requestedToken,
        });
        if (data?.session_id === requestedSession && data?.channel === 'web') validatedSession = data;
      }
      const canReuse = Boolean(validatedSession);
      let sessionId = requestedSession;
      let sessionToken = requestedToken;
      let sessionExpiresAt = validatedSession?.expires_at || null;
      if (!canReuse) {
        const { data: createdSession, error: sessionError } = await supabase.rpc('ai_create_client_session', {
          p_hotel_id: hotelId,
          p_channel: 'web',
          p_conversation_id: null,
          p_ttl_minutes: 1440,
        });
        if (sessionError || !createdSession) throw sessionError || new Error('client_session_creation_failed');
        sessionId = createdSession.session_id;
        sessionToken = createdSession.session_token;
        sessionExpiresAt = createdSession.expires_at;
      }
      let messages: Array<Record<string, unknown>> = [];
      if (canReuse) {
        const { data: previousConversation } = await supabase.from('ai_conversations')
          .select('id').eq('hotel_id', hotelId).eq('session_id', sessionId).maybeSingle();
        if (previousConversation) {
          const { data: transcript } = await supabase.from('ai_messages')
            .select('id,role,content,created_at').eq('hotel_id', hotelId)
            .eq('conversation_id', previousConversation.id).in('role', ['user', 'assistant'])
            .order('created_at', { ascending: false }).limit(50);
          messages = (transcript || []).reverse();
        }
      }
      return jsonResponse({
        session_id: sessionId,
        session_token: sessionToken,
        session_expires_at: sessionExpiresAt,
        messages,
        config: {
          agent_enabled: config.agent_enabled,
          agent_name: config.agent_name,
          welcome_message: config.welcome_message,
          languages: config.languages,
          operating_hours: config.operating_hours
        }
      });
    }

    const channel = body.channel || 'web';
    const isExternalChannel = ['whatsapp', 'instagram', 'facebook', 'guest_portal'].includes(channel);
    const signedCredential = isExternalChannel ? await authenticateChannelRequest(supabase, req, rawBody) : null;
    const isTrustedChannelRequest = Boolean(signedCredential)
      && signedCredential.hotel_id === hotelId
      && signedCredential.channel === channel
      && signedCredential.enabled === true
      && ['connected', 'degraded'].includes(String(signedCredential.status || ''));
    if (isExternalChannel && !isTrustedChannelRequest) return errorResponse('Invalid channel credentials', 401);

    const externalAccountId = String(body.external_account_id || '').trim();
    const externalContactId = String(body.external_contact_id || '').trim();
    const externalMessageId = String(body.external_message_id || '').trim();
    let channelDelaySeconds = Number(config.response_delay_seconds || 0);
    let sessionId = String(body.session_id || '');
    const sessionToken = String(body.session_token || '');
    const message = String(body.message || '').trim();
    if (isTrustedChannelRequest) {
      if (!externalAccountId) return errorResponse('Missing external account identifier', 400);
      if (externalAccountId !== signedCredential.external_account_id) return errorResponse('Channel account mismatch', 403);
      if (!['delivery_status', 'pull_outbound', 'ack_outbound', 'nack_outbound', 'pull_events', 'ack_event', 'nack_event', 'submit_payment_evidence'].includes(body.action || 'message')
        && (!externalContactId || !externalMessageId || !message)) {
        return errorResponse('Missing normalized channel fields', 400);
      }
      if (externalAccountId.length > 200 || externalContactId.length > 200 || externalMessageId.length > 300) {
        return errorResponse('Channel identifier is too long', 400);
      }
      const { data: channelConnection, error: channelConnectionError } = await supabase
        .from('ai_channel_connections')
        .select('id,response_delay_seconds,enabled,status,max_concurrent_messages')
        .eq('hotel_id', hotelId)
        .eq('channel', channel)
        .eq('external_account_id', externalAccountId)
        .eq('enabled', true)
        .maybeSingle();
      if (channelConnectionError || !channelConnection) return errorResponse('Channel is not enabled for this hotel', 403);
      if (channelConnection.id !== signedCredential.connection_id || !['connected', 'degraded'].includes(channelConnection.status)) {
        return errorResponse('Credential does not belong to the active channel connection', 403);
      }
      const outboundBelongsToConnection = async (messageId: string): Promise<boolean> => {
        const { data: outbound } = await supabase.from('ai_messages').select('conversation_id')
          .eq('id', messageId).eq('hotel_id', hotelId).eq('direction', 'outbound').maybeSingle();
        if (!outbound) return false;
        const { data: owner } = await supabase.from('ai_conversations').select('id')
          .eq('id', outbound.conversation_id).eq('hotel_id', hotelId).eq('channel', channel)
          .eq('external_account_id', externalAccountId).maybeSingle();
        return Boolean(owner);
      };
      channelDelaySeconds = Number(channelConnection.response_delay_seconds || channelDelaySeconds);
      if (body.action === 'delivery_status') {
        const deliveryMessageId = String(body.delivery_message_id || '');
        const deliveryStatus = String(body.delivery_status || '');
        if (!uuidPattern.test(deliveryMessageId) || !['sent', 'delivered', 'read', 'failed'].includes(deliveryStatus)) {
          return errorResponse('Invalid delivery status event', 400);
        }
        if (!await outboundBelongsToConnection(deliveryMessageId)) return errorResponse('Outbound message not found', 404);
        const { data: updated, error: deliveryError } = await supabase.rpc('ai_update_delivery_status', {
          p_message_id: deliveryMessageId,
          p_status: deliveryStatus,
          p_external_message_id: body.provider_message_id ? String(body.provider_message_id).slice(0, 300) : null,
          p_error: deliveryStatus === 'failed' ? String(body.error_code || 'channel_delivery_failed').slice(0, 500) : null,
        });
        if (deliveryError) throw deliveryError;
        if (!updated) return errorResponse('Outbound message is not valid for this receipt', 409);
        return jsonResponse({ success: true, message_id: deliveryMessageId, delivery_status: deliveryStatus });
      }
      if (body.action === 'pull_outbound') {
        const requestedLimit = Number(body.limit || 10);
        const workerId = String(body.worker_id || '').trim();
        if (!/^[A-Za-z0-9._:-]{8,128}$/.test(workerId)) return errorResponse('Valid worker_id is required', 400);
        const { data: outboundMessages, error: outboundError } = await supabase.rpc('ai_claim_channel_messages_v2', {
          p_hotel_id: hotelId,
          p_channel: channel,
          p_external_account_id: externalAccountId,
          p_worker_id: workerId,
          p_limit: Number.isFinite(requestedLimit)
            ? Math.min(Math.max(Math.trunc(requestedLimit), 1), Number(channelConnection.max_concurrent_messages || 1), 50)
            : 1,
          p_lease_seconds: 60,
        });
        if (outboundError) throw outboundError;
        return jsonResponse({ success: true, messages: outboundMessages || [] });
      }
      if (body.action === 'ack_outbound' || body.action === 'nack_outbound') {
        const deliveryMessageId = String(body.delivery_message_id || '');
        const workerId = String(body.worker_id || '').trim();
        if (!uuidPattern.test(deliveryMessageId) || !/^[A-Za-z0-9._:-]{8,128}$/.test(workerId)) {
          return errorResponse('Valid delivery_message_id and worker_id are required', 400);
        }
        if (!await outboundBelongsToConnection(deliveryMessageId)) return errorResponse('Outbound message not found', 404);
        if (body.action === 'ack_outbound' && !String(body.provider_message_id || '').trim()) {
          return errorResponse('provider_message_id is required to acknowledge delivery', 400);
        }
        const rpcName = body.action === 'ack_outbound' ? 'ai_ack_channel_message' : 'ai_nack_channel_message';
        const rpcArgs = body.action === 'ack_outbound'
          ? {
            p_message_id: deliveryMessageId,
            p_worker_id: workerId,
            p_external_message_id: String(body.provider_message_id || '').slice(0, 300) || null,
          }
          : {
            p_message_id: deliveryMessageId,
            p_worker_id: workerId,
            p_error: String(body.error_code || 'connector_delivery_failed').slice(0, 500),
            p_permanent: body.permanent === true,
          };
        const { data: changed, error: mutationError } = await supabase.rpc(rpcName, rpcArgs);
        if (mutationError) throw mutationError;
        if (!changed) return errorResponse('Message lease is not owned by this worker', 409);
        return jsonResponse({ success: true, message_id: deliveryMessageId });
      }
      if (body.action === 'pull_events') {
        const workerId = String(body.worker_id || '').trim();
        const requestedLimit = Number(body.limit || 10);
        if (!/^[A-Za-z0-9._:-]{8,128}$/.test(workerId)) return errorResponse('Valid worker_id is required', 400);
        const { data: events, error: claimError } = await supabase.rpc('ai_claim_domain_events_v2', {
          p_hotel_id: hotelId,
          p_channel: channel,
          p_external_account_id: externalAccountId,
          p_worker_id: workerId,
          p_limit: Number.isFinite(requestedLimit)
            ? Math.min(Math.max(Math.trunc(requestedLimit), 1), Number(channelConnection.max_concurrent_messages || 1), 50)
            : 1,
          p_lease_seconds: 60,
        });
        if (claimError) throw claimError;
        const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/$/, '');
        const claimedEvents = [];
        for (const event of events || []) {
          let delivery: Record<string, unknown> | null = null;
          if (['reservation.confirmed', 'guest_access.delivery_requested'].includes(event.event_type)
            && event.aggregate_type === 'reservation' && uuidPattern.test(String(event.aggregate_id || ''))) {
            if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(publicAppUrl)) {
              await supabase.rpc('ai_nack_domain_event', {
                p_event_id: event.id, p_worker_id: workerId,
                p_error: 'PUBLIC_APP_URL is not configured', p_permanent: false,
              });
              continue;
            }
            const { data: tokens, error: tokenError } = await supabase.rpc('ai_rotate_guest_access_tokens', {
              p_reservation_id: event.aggregate_id,
            });
            if (tokenError || !tokens) {
              await supabase.rpc('ai_nack_domain_event', {
                p_event_id: event.id, p_worker_id: workerId,
                p_error: tokenError?.message || 'guest token generation failed', p_permanent: false,
              });
              continue;
            }
            delivery = {
              portal_url: `${publicAppUrl}/portal/${tokens.portal_token}`,
              checkin_url: `${publicAppUrl}/public-checkin/${tokens.checkin_token}`,
              expires_at: tokens.expires_at,
            };
          }
          claimedEvents.push({ ...event, delivery });
        }
        return jsonResponse({ success: true, events: claimedEvents });
      }
      if (body.action === 'ack_event' || body.action === 'nack_event') {
        const eventId = String(body.event_id || '');
        const workerId = String(body.worker_id || '').trim();
        if (!uuidPattern.test(eventId) || !/^[A-Za-z0-9._:-]{8,128}$/.test(workerId)) {
          return errorResponse('Valid event_id and worker_id are required', 400);
        }
        const { data: event } = await supabase.from('ai_domain_events').select('id,hotel_id,payload')
          .eq('id', eventId).eq('hotel_id', hotelId).maybeSingle();
        const conversationId = String(event?.payload?.conversation_id || '');
        if (!event || !uuidPattern.test(conversationId)) return errorResponse('Domain event not found', 404);
        const { data: eventConversation } = await supabase.from('ai_conversations').select('id')
          .eq('id', conversationId).eq('hotel_id', hotelId).eq('channel', channel)
          .eq('external_account_id', externalAccountId).maybeSingle();
        if (!eventConversation) return errorResponse('Domain event does not belong to this connection', 403);
        const rpcName = body.action === 'ack_event' ? 'ai_ack_domain_event' : 'ai_nack_domain_event';
        const rpcArgs = body.action === 'ack_event'
          ? { p_event_id: eventId, p_worker_id: workerId }
          : {
            p_event_id: eventId, p_worker_id: workerId,
            p_error: String(body.error_code || 'event_publish_failed').slice(0, 1000),
            p_permanent: body.permanent === true,
          };
        const { data: changed, error: eventMutationError } = await supabase.rpc(rpcName, rpcArgs);
        if (eventMutationError) throw eventMutationError;
        if (!changed) return errorResponse('Event lease is not owned by this worker', 409);
        return jsonResponse({ success: true, event_id: eventId });
      }
      if (body.action === 'submit_payment_evidence') {
        const paymentIntentId = String(body.payment_intent_id || '');
        const evidence = body.evidence || {};
        const mimeType = String(evidence.mime_type || '').toLowerCase();
        const extensionByMime: Record<string, string> = {
          'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
        };
        if (!uuidPattern.test(paymentIntentId) || !externalContactId || !extensionByMime[mimeType]) {
          return errorResponse('Invalid payment evidence metadata', 400);
        }
        const encoded = String(evidence.content_base64 || '');
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length > 7_000_000) {
          return errorResponse('Payment evidence must be a supported file up to 5 MB', 413);
        }
        let bytes: Uint8Array;
        try {
          bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
        } catch {
          return errorResponse('Payment evidence encoding is invalid', 400);
        }
        if (bytes.byteLength < 32 || bytes.byteLength > 5 * 1024 * 1024) {
          return errorResponse('Payment evidence must be a supported file up to 5 MB', 413);
        }
        if (!matchesEvidenceMime(bytes, mimeType)) return errorResponse('Payment evidence content does not match its MIME type', 400);
        const { data: payment } = await supabase.from('ai_payment_intents')
          .select('id,hotel_id,conversation_id,provider,status,amount').eq('id', paymentIntentId)
          .eq('hotel_id', hotelId).eq('provider', 'manual').in('status', ['pending', 'awaiting_manual_review'])
          .maybeSingle();
        if (!payment) return errorResponse('Manual payment is not awaiting evidence', 409);
        const { data: paymentConversation } = await supabase.from('ai_conversations').select('id')
          .eq('id', payment.conversation_id).eq('hotel_id', hotelId).eq('channel', channel)
          .eq('external_account_id', externalAccountId).eq('external_contact_id', externalContactId).maybeSingle();
        if (!paymentConversation) return errorResponse('Payment does not belong to this channel contact', 403);
        const contentHash = await sha256Bytes(bytes);
        const objectName = `${hotelId}/${paymentIntentId}/${crypto.randomUUID()}.${extensionByMime[mimeType]}`;
        const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(objectName, bytes, {
          contentType: mimeType,
          upsert: false,
          cacheControl: '0',
        });
        if (uploadError) throw uploadError;
        const observedAmount = Number(evidence.observed_amount);
        const observedAt = evidence.observed_at ? new Date(evidence.observed_at) : new Date();
        const { data: evidenceId, error: evidenceError } = await supabase.rpc('ai_submit_manual_payment_evidence', {
          p_payment_intent_id: paymentIntentId,
          p_evidence: {
            object_path: `payment-proofs/${objectName}`,
            content_sha256: contentHash,
            observed_amount: observedAmount,
            observed_at: Number.isFinite(observedAt.getTime()) ? observedAt.toISOString() : new Date().toISOString(),
            submitted_by: channel,
            metadata: { mime_type: mimeType, external_contact_id: externalContactId },
          },
        });
        if (evidenceError) {
          await supabase.storage.from('payment-proofs').remove([objectName]);
          throw evidenceError;
        }
        return jsonResponse({ success: true, evidence_id: evidenceId }, 201);
      }
      if (!uuidPattern.test(sessionId)) sessionId = crypto.randomUUID();
    } else {
      if (!uuidPattern.test(sessionId) || !sessionToken || !message) return errorResponse('Missing required fields', 400);
      const { data: validatedSession, error: sessionError } = await supabase.rpc('ai_validate_client_session', {
        p_hotel_id: hotelId,
        p_session_token: sessionToken,
      });
      if (sessionError || validatedSession?.session_id !== sessionId || validatedSession?.channel !== 'web') {
        return errorResponse('Invalid conversation session', 401);
      }
    }
    if (message.length > 2000) return errorResponse('Message is too long', 413);

    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-ip';
    const rateIdentity = isTrustedChannelRequest ? `${channel}:${externalContactId}` : clientIp;
    const ipHash = await sha256(`ai:${rateIdentity}:${hotelId}`);
    const { data: allowed, error: rateError } = await supabase.rpc('check_booking_rate_limit', {
      p_ip_hash: ipHash,
      p_max_attempts: 30,
      p_window_seconds: 300
    });
    if (rateError || allowed === false) return errorResponse('Too many messages. Try again shortly.', 429);

    if (isTrustedChannelRequest) {
      const { data: duplicate } = await supabase.from('ai_messages')
        .select('id,conversation_id').eq('hotel_id', hotelId).eq('external_message_id', externalMessageId).maybeSingle();
      if (duplicate) {
        const { data: previousResponse } = await supabase.from('ai_messages').select('id,content,delivery_status')
          .eq('conversation_id', duplicate.conversation_id).eq('reply_to_message_id', duplicate.id)
          .eq('role', 'assistant').maybeSingle();
        return jsonResponse({
          duplicate: true,
          conversation_id: duplicate.conversation_id,
          response: null,
          delivery: previousResponse ? { message_id: previousResponse.id, status: previousResponse.delivery_status } : null,
        });
      }
    }

    let conversationQuery = supabase
      .from('ai_conversations')
      .select('*')
      .eq('hotel_id', hotelId);
    conversationQuery = isTrustedChannelRequest
      ? conversationQuery.eq('channel', channel).eq('external_account_id', externalAccountId)
        .eq('external_contact_id', externalContactId).not('status', 'in', '(closed,abandoned)')
      : conversationQuery.eq('session_id', sessionId);
    const { data: existingConversation, error: conversationError } = await conversationQuery.maybeSingle();
    if (conversationError) throw conversationError;
    let conversation = existingConversation;

    if (!conversation) {
      const { data: created, error: createError } = await supabase.from('ai_conversations').insert({
        hotel_id: hotelId,
        session_id: sessionId,
        channel,
        external_account_id: isTrustedChannelRequest ? externalAccountId : null,
        external_contact_id: isTrustedChannelRequest ? externalContactId : null,
        status: 'active',
        journey_stage: 'lead',
        last_inbound_at: new Date().toISOString()
      }).select().single();
      if (createError) throw createError;
      conversation = created;
      await supabase.from('ai_messages').insert({
        conversation_id: conversation.id,
        hotel_id: hotelId,
        role: 'assistant',
        content: config.welcome_message,
        direction: 'outbound',
        delivery_status: isTrustedChannelRequest ? 'queued' : 'sent',
        next_attempt_at: isTrustedChannelRequest
          ? new Date(Date.now() + Math.max(0, channelDelaySeconds) * 1000).toISOString()
          : new Date().toISOString(),
      });
    }

    const { data: userMessage, error: userMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id: hotelId,
      role: 'user',
      content: message,
      direction: 'inbound',
      delivery_status: 'received',
      external_message_id: isTrustedChannelRequest ? externalMessageId : null
    }).select('id').single();
    if (userMessageError) {
      if (isTrustedChannelRequest && userMessageError.code === '23505') {
        return jsonResponse({ duplicate: true, response: null, status: 'processing' }, 202);
      }
      throw userMessageError;
    }
    await supabase.from('ai_conversations').update({
      last_inbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id);

    if (!config.agent_enabled) {
      await supabase.from('ai_conversations').update({
        status: 'handed_off', human_controlled: true, updated_at: new Date().toISOString(),
      }).eq('id', conversation.id).eq('hotel_id', hotelId);
      return jsonResponse({
        conversation_id: conversation.id,
        response: isTrustedChannelRequest ? null : config.handoff_message,
        human_controlled: true,
        status: 'handed_off',
        journey_stage: conversation.journey_stage,
      });
    }

    if (conversation.human_controlled || conversation.status === 'handed_off' || conversation.status === 'closed') {
      return jsonResponse({
        conversation_id: conversation.id,
        response: isTrustedChannelRequest ? null : config.handoff_message,
        human_controlled: true,
        status: conversation.status,
        journey_stage: conversation.journey_stage,
      });
    }

    const { data: historyData, error: historyError } = await supabase
      .from('ai_messages')
      .select('role,content')
      .eq('conversation_id', conversation.id)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (historyError) throw historyError;
    const history: any[] = (historyData || []).reverse();
    const modelHistory = history.map((entry) => ({ ...entry, content: redactPII(String(entry.content || '')) }));
    const protectedMessage = protectCurrentPII(message, conversation.journey_stage);

    const { data: knowledge, error: knowledgeError } = await supabase
      .from('ai_hotel_knowledge')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('activo', true)
      .order('priority', { ascending: false })
      .limit(100);
    if (knowledgeError) throw knowledgeError;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return errorResponse('AI model is not configured', 503);
    const systemPrompt = `${buildSystemPrompt(config, knowledge || [])}\nLos marcadores [PII_*] representan datos reales protegidos. Consérvalos exactamente al pasarlos a herramientas; nunca los repitas en la respuesta.`;
    let geminiSession = await callGemini(systemPrompt, modelHistory.slice(0, -1), protectedMessage.text, geminiToolsDefinition, apiKey);
    let finalResponseText = '';
    const executor = new ToolExecutor(supabase, hotelId, conversation.id, protectedMessage.vault);

    for (let iteration = 0; iteration < 5; iteration++) {
      const candidate = geminiSession.response.candidates?.[0];
      if (!candidate?.content?.parts) break;
      const parts = candidate.content.parts;
      const textParts = parts.filter((part: any) => typeof part.text === 'string');
      if (textParts.length) finalResponseText += textParts.map((part: any) => part.text).join('');
      const calls = parts.filter((part: any) => part.functionCall).map((part: any) => part.functionCall);
      if (!calls.length) break;

      const toolResults = [];
      for (const call of calls) {
        const result = await executor.executeTool(call.name, call.args || {});
        const safeResult = sanitizeForModel(result);
        toolResults.push({ name: call.name, result: safeResult });
        await supabase.from('ai_messages').insert({
          conversation_id: conversation.id,
          hotel_id: hotelId,
          role: 'tool',
          content: `Executed ${call.name}`,
          tool_name: call.name,
          tool_calls: { name: call.name, args: sanitizeForModel(call.args || {}) },
          tool_result: safeResult,
          direction: 'internal',
          delivery_status: 'sent'
        });
      }

      geminiSession = await submitToolResponseToGemini(
        systemPrompt, geminiSession, parts, toolResults, geminiToolsDefinition, apiKey
      );
    }

    if (!finalResponseText.trim()) finalResponseText = 'No pude completar la solicitud. Te comunicaré con recepción.';
    const initialDeliveryStatus = isTrustedChannelRequest ? 'queued' : 'sent';
    const { data: assistantMessage, error: assistantMessageError } = await supabase.from('ai_messages').insert({
      conversation_id: conversation.id,
      hotel_id: hotelId,
      role: 'assistant',
      content: finalResponseText.trim(),
      direction: 'outbound',
      delivery_status: initialDeliveryStatus,
      reply_to_message_id: userMessage.id,
      next_attempt_at: isTrustedChannelRequest
        ? new Date(Date.now() + Math.max(0, channelDelaySeconds) * 1000).toISOString()
        : new Date().toISOString(),
    }).select('id').single();
    if (assistantMessageError) throw assistantMessageError;

    await supabase.from('ai_conversations').update({
      last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq('id', conversation.id);
    const { data: updatedConversation } = await supabase
      .from('ai_conversations').select('status,journey_stage,reserva_id').eq('id', conversation.id).single();

    return jsonResponse({
      conversation_id: conversation.id,
      response: isTrustedChannelRequest ? null : finalResponseText.trim(),
      status: updatedConversation?.status || conversation.status,
      journey_stage: updatedConversation?.journey_stage || conversation.journey_stage,
      reservation_id: updatedConversation?.reserva_id || null,
      delivery: {
        message_id: assistantMessage.id,
        delay_seconds: isTrustedChannelRequest ? channelDelaySeconds : 0,
        status: isTrustedChannelRequest ? 'queued' : 'sent'
      }
    });
  } catch (error: any) {
    console.error('[AI Gateway Error]', error);
    return errorResponse('Could not process the conversation', 500);
  }
});
