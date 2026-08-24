import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const traceId = requestId(req);
  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || 'Unauthorized', auth.status);
  try {
    const { evidence_id: evidenceId } = await req.json();
    if (!uuidPattern.test(String(evidenceId || ''))) return errorResponse('Invalid evidence_id', 400);
    const db = createAdminClient();
    let canVerify = ['admin', 'developer'].includes(auth.user.role);
    if (auth.user.role === 'recepcionista') {
      const { data: profile } = await db.from('usuarios').select('permissions').eq('id', auth.user.id).single();
      canVerify = profile?.permissions?.verify_manual_payments === true;
    }
    if (!canVerify) return errorResponse('Payment verification privilege required', 403);
    const { data: evidence, error } = await db.from('ai_manual_payment_evidence')
      .select('id,hotel_id,object_path,content_sha256,observed_amount,observed_at,verified_at')
      .eq('id', evidenceId).single();
    if (error || !evidence) return errorResponse('Evidence not found', 404);
    if (auth.user.role !== 'developer' && auth.user.hotel_id !== evidence.hotel_id) return errorResponse('Cross-tenant access denied', 403);
    const prefix = 'payment-proofs/';
    if (!evidence.object_path.startsWith(prefix)) return errorResponse('Evidence object path is invalid', 409);
    const { data: signed, error: signedError } = await db.storage.from('payment-proofs')
      .createSignedUrl(evidence.object_path.slice(prefix.length), 300);
    if (signedError || !signed?.signedUrl) throw signedError || new Error('signed_url_creation_failed');
    logEvent('info', 'payment_evidence_reviewed', {
      request_id: traceId, evidence_id: evidence.id, hotel_id: evidence.hotel_id, reviewer_id: auth.user.id,
    });
    return noStoreJson({
      evidence: {
        id: evidence.id, content_sha256: evidence.content_sha256,
        observed_amount: evidence.observed_amount, observed_at: evidence.observed_at,
        verified_at: evidence.verified_at,
      },
      signed_url: signed.signedUrl,
      expires_in_seconds: 300,
      request_id: traceId,
    }, 200, corsHeaders);
  } catch (error) {
    logEvent('error', 'payment_evidence_review_failed', {
      request_id: traceId, error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Could not review payment evidence', 500);
  }
});
