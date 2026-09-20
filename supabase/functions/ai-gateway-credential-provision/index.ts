// supabase/functions/ai-gateway-credential-provision/index.ts
// Provisión de credenciales de canal

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { uuidPattern } from "./_shared/crypto.ts";
import { encryptCredential } from "../_shared/credentials.ts";
import { logEvent } from "../_shared/runtime.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = crypto.randomUUID();
  try {
    const rawBody = await req.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    const credentialId = `jcar_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
    const secret = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
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
  } catch (error: any) {
    console.error('[Credential Provision Error]', error);
    return errorResponse('Could not provision credential', 500);
  }
});