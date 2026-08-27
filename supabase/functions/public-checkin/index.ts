import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

declare const Deno: any;

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const traceId = requestId(req);
  try {
    const body = await req.json();
    if (!['load', 'submit'].includes(body.action) || typeof body.token !== "string"
      || body.token.length < 40 || body.token.length > 100) {
      return errorResponse("Invalid link", 400);
    }
    const db = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const tokenHash = await sha256(body.token);

    if (body.action === 'load') {
      const { data, error } = await db.rpc('get_public_checkin_context', { p_token_hash: tokenHash });
      if (error || !data) return errorResponse("Link expired, revoked or not eligible", 404);
      const { data: hotel } = await db.from('hoteles').select('id,nombre,logo_url')
        .eq('id', data.hotel_id).single();
      return noStoreJson({
        hotel,
        reservation: {
          id: data.reservation_id,
          numero_reserva: data.reservation_number,
          huesped_nombre: data.guest_name,
          tipo_documento: data.document_type,
          fecha_entrada: data.check_in,
          fecha_salida: data.check_out,
          habitacion_numero: data.room_number,
        },
        submitted: false,
        request_id: traceId,
      }, 200, { ...corsHeaders, 'X-Request-Id': traceId });
    }

    if (!body.guest || typeof body.guest !== 'object' || Array.isArray(body.guest)) {
      return errorResponse('Invalid guest data', 400);
    }
    const guest = {
      nombre: String(body.guest.nombre || '').trim(),
      tipo_documento: String(body.guest.tipo_documento || '').trim(),
      documento: String(body.guest.documento || '').trim(),
      telefono: String(body.guest.telefono || '').trim(),
      email: String(body.guest.email || '').trim() || null,
      observaciones: String(body.guest.observaciones || '').trim() || null,
    };
    if (guest.nombre.length < 3 || guest.nombre.length > 150 || guest.telefono.length < 6
      || guest.telefono.length > 30 || (guest.email && guest.email.length > 254)
      || (guest.observaciones && guest.observaciones.length > 1000)) {
      return errorResponse('Invalid guest data', 400);
    }
    const { data, error } = await db.rpc('submit_public_checkin_atomic', {
      p_token_hash: tokenHash,
      p_guest: guest,
    });
    if (error) {
      const conflict = /already|used|submitted/i.test(error.message || '');
      const expired = /expired|revoked|not eligible|not found/i.test(error.message || '');
      return errorResponse(conflict ? 'Check-in was already submitted' : expired ? 'Link expired, revoked or not eligible' : 'Invalid guest data', conflict ? 409 : expired ? 404 : 400);
    }
    logEvent('info', 'public_checkin_submitted', {
      request_id: traceId,
      reservation_id: data?.reservation_id,
      hotel_id: data?.hotel_id,
    });
    return noStoreJson({ ...data, request_id: traceId }, 201, { ...corsHeaders, 'X-Request-Id': traceId });
  } catch (error) {
    logEvent('warn', 'public_checkin_failed', {
      request_id: traceId,
      error: error instanceof Error ? error.message.slice(0, 160) : 'unknown_error',
    });
    return errorResponse("Check-in request failed", 400);
  }
});
