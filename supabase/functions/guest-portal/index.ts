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
    const { action, token } = await req.json();
    if (action !== "load" || typeof token !== "string" || token.length < 40 || token.length > 100) return errorResponse("Invalid link", 400);
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: access } = await db.from("guest_access_tokens").select("reservation_id,expires_at,revoked_at")
      .eq("token_hash", await sha256(token)).eq("scope", "portal").maybeSingle();
    if (!access || access.revoked_at || new Date(access.expires_at) <= new Date()) return errorResponse("Link expired or revoked", 404);
    const { data: reservation, error } = await db.from("reservas")
      .select("id,hotel_id,huesped_nombre,habitacion_numero,fecha_entrada,fecha_salida,total,estado")
      .eq("id", access.reservation_id).single();
    if (error || !reservation) return errorResponse("Reservation not found", 404);
    const { data: hotel } = await db.from("hoteles").select("id,nombre,telefono,celular").eq("id", reservation.hotel_id).single();
    return Response.json({
      reservation: { id: reservation.id, huesped_nombre: reservation.huesped_nombre, habitacion_numero: reservation.habitacion_numero, fecha_entrada: reservation.fecha_entrada, fecha_salida: reservation.fecha_salida, total: reservation.total, estado: reservation.estado },
      hotel: hotel ? { id: hotel.id, nombre: hotel.nombre, whatsapp: hotel.celular || hotel.telefono || null } : null,
      extras: [],
    }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[GUEST-PORTAL] Failed:", error);
    return errorResponse("Invalid guest link", 400);
  }
});
