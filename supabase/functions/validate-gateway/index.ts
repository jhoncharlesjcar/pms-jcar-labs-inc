import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);
  if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse("Administrator role required", 403);

  // Credential validation previously accepted any non-401 response and contained a Niubiz
  // length-only mock. Do not transmit private keys until a provider-specific server adapter exists.
  return errorResponse("Payment credential validation adapter is not installed", 501);
});
