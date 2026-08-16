import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";

declare const Deno: any;
async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  try {
    const body = await req.json();
    if (typeof body.token !== "string" || body.token.length < 40 || body.token.length > 100) return errorResponse("Invalid link", 400);
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const tokenHash = await sha256(body.token);
    const { data: access } = await db.from("guest_access_tokens")
      .select("id,reservation_id,expires_at,revoked_at,used_at")
      .eq("token_hash", tokenHash).eq("scope", "checkin").maybeSingle();
    if (!access || access.revoked_at || new Date(access.expires_at) <= new Date()) return errorResponse("Link expired or revoked", 404);
    const { data: reservation } = await db.from("reservas")
      .select("id,hotel_id,fecha_entrada,fecha_salida,estado").eq("id", access.reservation_id).single();
    if (!reservation || !["pendiente", "activa"].includes(reservation.estado)) return errorResponse("Reservation is not eligible", 409);
    const { data: hotel } = await db.from("hoteles").select("id,nombre").eq("id", reservation.hotel_id).single();
    if (body.action === "load") {
      return Response.json({ hotel, reservation: { fecha_entrada: reservation.fecha_entrada, fecha_salida: reservation.fecha_salida }, submitted: Boolean(access.used_at) }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }
    if (body.action !== "submit") return errorResponse("Unsupported action", 400);
    if (access.used_at) return errorResponse("Check-in was already submitted", 409);

    const guest = body.guest || {};
    const record = {
      nombre: String(guest.nombre || "").trim(), tipo_documento: String(guest.tipo_documento || ""),
      documento: String(guest.documento || "").trim(), telefono: String(guest.telefono || "").trim(),
      email: String(guest.email || "").trim() || null, observaciones: String(guest.observaciones || "").trim() || null,
    };
    if (record.nombre.length < 3 || record.nombre.length > 150 || !["DNI", "Pasaporte", "CE"].includes(record.tipo_documento)
      || record.documento.length < 6 || record.documento.length > 20 || record.telefono.length < 6 || record.telefono.length > 30
      || (record.email && record.email.length > 254) || (record.observaciones && record.observaciones.length > 1000)) {
      return errorResponse("Invalid guest data", 400);
    }
    const { error: insertError } = await db.from("checkins_publicos").insert({
      reservation_id: reservation.id, hotel_id: reservation.hotel_id, ...record,
    });
    if (insertError) {
      if (insertError.code === "23505") return errorResponse("Check-in was already submitted", 409);
      throw insertError;
    }
    const { data: claimed, error: updateError } = await db.from("guest_access_tokens").update({ used_at: new Date().toISOString() })
      .eq("id", access.id).is("used_at", null).select("id").maybeSingle();
    if (updateError || !claimed) {
      await db.from("checkins_publicos").delete().eq("reservation_id", reservation.id);
      if (updateError) throw updateError;
      return errorResponse("Check-in was already submitted", 409);
    }
    return Response.json({ success: true }, { status: 201, headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PUBLIC-CHECKIN] Failed:", error);
    return errorResponse("Check-in request failed", 400);
  }
});
