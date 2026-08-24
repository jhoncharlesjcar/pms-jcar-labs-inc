import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateCronJob,
  corsHeaders,
  createAdminClient,
  errorResponse,
} from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const auth = authenticateCronJob(req);
  if (!auth.valid) return errorResponse(auth.error || 'Unauthorized', 401);
  const traceId = requestId(req);

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc('ai_expire_booking_artifacts');
    if (error) throw error;
    const { data: retention, error: retentionError } = await db.rpc('ai_retention_maintenance');
    if (retentionError) throw retentionError;
    logEvent('info', 'ai_maintenance_completed', { request_id: traceId, expired: data, retention });
    return noStoreJson({ success: true, expired: data, retention, request_id: traceId }, 200, corsHeaders);
  } catch (error) {
    logEvent('error', 'ai_maintenance_failed', { request_id: traceId, error: error instanceof Error ? error.message : String(error) });
    return errorResponse('Could not expire booking artifacts', 500);
  }
});
