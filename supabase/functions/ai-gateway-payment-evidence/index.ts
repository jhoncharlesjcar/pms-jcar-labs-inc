// supabase/functions/ai-gateway-payment-evidence/index.ts
// Envío y revisión de evidencias de pago manual

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { authenticateRequest, corsHeaders, errorResponse, jsonResponse } from "../_shared/auth-middleware.ts";
import { uuidPattern } from "./_shared/crypto.ts";
import { matchesEvidenceMime } from "../_shared/pii.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method Not Allowed', 405);

  const traceId = crypto.randomUUID();
  try {
    const rawBody = await req.text();
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return errorResponse('Invalid JSON body', 400); }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const hotelId = String(body.hotel_id || '');
    if (!uuidPattern.test(hotelId)) return errorResponse('Invalid hotel_id', 400);

    const auth = await authenticateRequest(req);
    if (auth.error || !auth.user) return errorResponse(auth.error || 'Unauthorized', auth.status);
    if (!['admin', 'developer', 'recepcionista'].includes(auth.user.role)) {
      return errorResponse('Role not allowed to submit payment evidence', 403);
    }
    if (auth.user.role !== 'developer' && auth.user.hotel_id !== hotelId) {
      return errorResponse('Cross-tenant access denied', 403);
    }

    const action = body.action;

    // Submit payment evidence (from channel connector)
    if (action === 'submit_payment_evidence') {
      const paymentIntentId = String(body.payment_intent_id || '');
      const evidence = body.evidence || {};
      const mimeType = String(evidence.mime_type || '').toLowerCase();
      const extensionByMime: Record<string, string> = {
        'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf',
      };

      if (!uuidPattern.test(paymentIntentId) || !body.external_contact_id || !extensionByMime[mimeType]) {
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

      const contentHash = await sha256Bytes(bytes);
      const objectName = `${hotelId}/${paymentIntentId}/${crypto.randomUUID()}.${extensionByMime[mimeType]}`;

      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(objectName, bytes, {
        contentType: mimeType, upsert: false, cacheControl: '0',
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
          submitted_by: 'connector',
          metadata: { mime_type: mimeType, external_contact_id: body.external_contact_id },
        },
      });

      if (evidenceError) {
        await supabase.storage.from('payment-proofs').remove([objectName]);
        throw evidenceError;
      }

      return jsonResponse({ success: true, evidence_id: evidenceId }, 201);
    }

    // Review payment evidence (admin/recepcionista)
    if (action === 'review_payment_evidence') {
      if (!['admin', 'developer', 'recepcionista'].includes(auth.user.role)) {
        return errorResponse('Role not allowed to review payment evidence', 403);
      }

      const evidenceId = String(body.evidence_id || '');
      if (!uuidPattern.test(evidenceId)) return errorResponse('Invalid evidence_id', 400);

      const { data: evidence, error: evidenceError } = await supabase
        .from('ai_manual_payment_evidence')
        .select('id,object_path,content_sha256,observed_amount,observed_at,submitted_by,verified_at,created_at')
        .eq('id', evidenceId).eq('hotel_id', hotelId).maybeSingle();

      if (evidenceError || !evidence) return errorResponse('Payment evidence not found', 404);

      // Generate signed URL for viewing
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('payment-proofs').createSignedUrl(evidence.object_path, 300); // 5 min

      if (urlError || !signedUrl) return errorResponse('Could not generate signed URL', 500);

      return jsonResponse({ 
        signed_url: signedUrl.signedUrl, 
        expires_in_seconds: 300,
        evidence: {
          id: evidence.id,
          observed_amount: evidence.observed_amount,
          observed_at: evidence.observed_at,
          submitted_by: evidence.submitted_by,
          verified_at: evidence.verified_at,
          created_at: evidence.created_at,
        }
      });
    }

    // Verify manual payment (admin)
    if (action === 'verify_manual_payment') {
      if (!['admin', 'developer', 'recepcionista'].includes(auth.user.role)) {
        return errorResponse('Role not allowed to verify payments', 403);
      }

      const paymentIntentId = String(body.payment_intent_id || '');
      const reference = String(body.reference || '');
      const evidenceId = String(body.evidence_id || '');

      if (!uuidPattern.test(paymentIntentId) || !reference || !uuidPattern.test(evidenceId)) {
        return errorResponse('Invalid parameters', 400);
      }

      const { data, error } = await supabase.rpc('ai_verify_manual_payment', {
        p_payment_intent_id: paymentIntentId,
        p_reference: reference,
        p_evidence: { evidence_id: evidenceId },
      });

      if (error) throw error;
      return jsonResponse({ success: true, message: data });
    }

    return errorResponse('Unknown action', 400);
  } catch (error: any) {
    console.error('[Payment Evidence Error]', error);
    return errorResponse('Could not process payment evidence', 500);
  }
});

// Import at top level for sha256Bytes
async function sha256Bytes(value: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', value);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}