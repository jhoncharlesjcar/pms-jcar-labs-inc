import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  authenticateRequest,
  corsHeaders,
  errorResponse,
} from "../_shared/auth-middleware.ts";

declare const Deno: any;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);

  try {
    const { reserva_id, pasarela } = await req.json();
    if (!reserva_id || !pasarela) return errorResponse("reserva_id and pasarela are required", 400);

    // There is no real provider adapter in this repository. Never mint a local UUID/QR and
    // present it as a payment order: it cannot be verified against a provider later.
    const enabled = Deno.env.get("PAYMENTS_AUTOMATIC_ENABLED") === "true";
    const configuredProvider = Deno.env.get("PAYMENT_PROVIDER");
    if (!enabled || !configuredProvider) {
      return errorResponse("Automatic payments are disabled by server configuration", 503);
    }
    if (pasarela !== configuredProvider) {
      return errorResponse("Requested payment provider is not enabled", 400);
    }

    return errorResponse(
      "Payment provider adapter is not installed; use the manual payment flow",
      501,
    );
  } catch (error) {
    console.error("[PAYMENT] Request rejected:", error);
    return errorResponse("Invalid payment request", 400);
  }
});
