import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateCronJob,
  corsHeaders,
  createAdminClient,
  errorResponse,
} from "../_shared/auth-middleware.ts";

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const auth = authenticateCronJob(req);
  if (!auth.valid) return errorResponse(auth.error || 'Unauthorized', 401);

  try {
    const db = createAdminClient();
    const { data, error } = await db.rpc('ai_expire_booking_artifacts');
    if (error) throw error;
    return Response.json({ success: true, expired: data }, { headers: corsHeaders });
  } catch (error) {
    console.error('[AI EXPIRATION] Failed:', error);
    return errorResponse('Could not expire booking artifacts', 500);
  }
});
