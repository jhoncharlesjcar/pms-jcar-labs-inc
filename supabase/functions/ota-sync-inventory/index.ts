import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);
  if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse("Administrator role required", 403);

  // No OTA adapter exists in this repository. Returning success for mock inventory would
  // make operators believe external inventory was updated when it was not.
  return errorResponse("OTA inventory provider adapter is not installed", 501);
});
