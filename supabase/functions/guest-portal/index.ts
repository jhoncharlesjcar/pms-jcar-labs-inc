import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, requestId } from "../_shared/runtime.ts";

declare const Deno: any;
async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const correlationId = requestId(req);
  try {
    const { action, token, type = "portal" } = await req.json();
    if (action !== "load" || type !== "portal" || typeof token !== "string" || token.length < 40 || token.length > 100) {
      return errorResponse("Invalid portal request", 400);
    }

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const tokenHash = await sha256(token);
    
    // Validar token
    const { data: access } = await db.from("guest_access_tokens").select("id,reservation_id,expires_at,revoked_at,scope")
      .eq("token_hash", tokenHash).eq("scope", type).maybeSingle();
      
    if (!access || access.revoked_at || new Date(access.expires_at) <= new Date()) {
      return errorResponse("Link expired or revoked", 404);
    }
    
    if (action === "load") {
      const { data: reservation, error } = await db.from("reservas")
        .select("id,hotel_id,huesped_nombre,habitacion_numero,fecha_entrada,fecha_salida,total,estado")
        .eq("id", access.reservation_id).single();
      if (error || !reservation) return errorResponse("Reservation not found", 404);
      const { data: hotel } = await db.from("hoteles").select("id,nombre,telefono,celular,logo_url").eq("id", reservation.hotel_id).single();
      
      return Response.json({
        reservation,
        hotel: hotel ? { id: hotel.id, nombre: hotel.nombre, logo_url: hotel.logo_url, whatsapp: hotel.celular || hotel.telefono || null } : null,
      }, { headers: { ...corsHeaders, "Cache-Control": "no-store", "X-Request-Id": correlationId } });
    }
    return errorResponse("Invalid portal request", 400);
  } catch (error) {
    logEvent('warn', 'guest_portal_failed', {
      request_id: correlationId,
      error: error instanceof Error ? error.message.slice(0, 160) : 'unknown_error',
    });
    return errorResponse("Invalid guest link", 400);
  }
});
