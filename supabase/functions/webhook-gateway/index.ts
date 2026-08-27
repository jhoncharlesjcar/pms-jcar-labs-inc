import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

declare const Deno: any;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store, max-age=0" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  const traceId = requestId(req);
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  const secret = Deno.env.get("WEBHOOK_SIGNING_SECRET");
  const provider = Deno.env.get("PAYMENT_WEBHOOK_PROVIDER");
  const successTypes = (Deno.env.get("PAYMENT_SUCCESS_EVENT_TYPES") || "")
    .split(",").map((v: string) => v.trim()).filter(Boolean);
  if (!secret || !provider || successTypes.length === 0) {
    console.error("[WEBHOOK] Provider contract is not configured");
    return jsonError("Server misconfigured", 503);
  }

  try {
    const rawSignature = req.headers.get("x-signature") || req.headers.get(`${provider}-signature`);
    if (!rawSignature) return jsonError("Missing signature", 403);
    const signature = rawSignature.replace(/^sha256=/i, "").toLowerCase();
    const rawBody = await req.text();
    const expected = await computeHmac(secret, rawBody);
    if (!constantTimeEqual(signature, expected)) return jsonError("Invalid signature", 403);

    const payload = JSON.parse(rawBody);
    const eventId = payload.event_id;
    const eventType = payload.type;
    const timestamp = payload.created_at;
    const paymentIntentId = payload.data?.payment_intent_id;
    const amount = payload.data?.amount;
    const currency = payload.data?.currency;
    const status = payload.data?.status;

    if (!eventId || !eventType || !timestamp || !paymentIntentId || amount === undefined || !currency || !status) {
      return jsonError("Incomplete payment event", 400);
    }
    if (!successTypes.includes(eventType) || !["paid", "succeeded", "approved"].includes(String(status).toLowerCase())) {
      return jsonError("Event is not a configured successful payment", 422);
    }
    const eventTime = new Date(timestamp).getTime();
    if (!Number.isFinite(eventTime) || Math.abs(Date.now() - eventTime) > 5 * 60 * 1000) {
      return jsonError("Event outside time window", 400);
    }
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return jsonError("Invalid amount", 400);
    }
    if (!/^[A-Z]{3}$/.test(currency)) return jsonError("Invalid currency", 400);

    const paymentUuid = String(paymentIntentId);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(paymentUuid)) {
      return jsonError("Invalid payment intent", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: reservaId, error } = await supabase.rpc("ai_process_payment_event", {
      p_payment_intent_id: paymentUuid,
      p_event_id: String(eventId),
      p_amount: amount,
      p_currency: currency,
      p_provider: provider,
      p_payload: payload,
    });
    if (error) {
      if (error.code === "23505") return jsonError("Event already processed", 409);
      logEvent("warn", "payment_webhook_rejected", { request_id: traceId, provider, code: error.code });
      return jsonError("Payment confirmation rejected", 409);
    }

    logEvent("info", "payment_webhook_processed", {
      request_id: traceId, provider, event_id: String(eventId), payment_intent_id: paymentUuid,
      result: reservaId ? "reservation_confirmed" : "reconciliation_required",
    });
    return noStoreJson({ status: "ok", reserva_id: reservaId, reconciliation_required: !reservaId, request_id: traceId });
  } catch (error) {
    logEvent("error", "payment_webhook_failed", { request_id: traceId, error: error instanceof Error ? error.message : String(error) });
    return jsonError("Invalid webhook request", 400);
  }
});
