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
    const { action, token, type = "portal", payload } = await req.json();
    if (!["load", "submit"].includes(action) || typeof token !== "string" || token.length < 40 || token.length > 100) return errorResponse("Invalid link", 400);
    if (!["portal", "checkin"].includes(type)) return errorResponse("Invalid type", 400);

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const tokenHash = await sha256(token);
    
    // Validar token
    const { data: access } = await db.from("guest_access_tokens").select("id,reservation_id,expires_at,revoked_at,scope")
      .eq("token_hash", tokenHash).eq("scope", type).maybeSingle();
      
    if (!access || access.revoked_at || new Date(access.expires_at) <= new Date()) {
      return errorResponse(type === 'checkin' ? "Check-in link expired or already used" : "Link expired or revoked", 404);
    }
    
    if (action === "load") {
      const { data: reservation, error } = await db.from("reservas")
        .select("id,hotel_id,huesped_nombre,huesped_dni,huesped_telefono,huesped_email,huesped_fecha_nacimiento,huesped_profesion,huesped_estado_civil,huesped_procedencia,huesped_destino,motivo_viaje,nacionalidad,tipo_documento,habitacion_numero,fecha_entrada,fecha_salida,total,estado")
        .eq("id", access.reservation_id).single();
      if (error || !reservation) return errorResponse("Reservation not found", 404);
      const { data: hotel } = await db.from("hoteles").select("id,nombre,telefono,celular,logo_url").eq("id", reservation.hotel_id).single();
      
      return Response.json({
        reservation,
        hotel: hotel ? { id: hotel.id, nombre: hotel.nombre, logo_url: hotel.logo_url, whatsapp: hotel.celular || hotel.telefono || null } : null,
      }, { headers: { ...corsHeaders, "Cache-Control": "no-store" } });
    }
    
    if (action === "submit" && type === "checkin") {
       // Guardar datos del auto-registro
       if (!payload) return errorResponse("Missing payload", 400);
       
       const { error: updateError } = await db.from("reservas").update({
          huesped_nombre: payload.huesped_nombre,
          huesped_dni: payload.huesped_dni,
          huesped_telefono: payload.huesped_telefono,
          huesped_email: payload.huesped_email,
          huesped_fecha_nacimiento: payload.huesped_fecha_nacimiento,
          huesped_profesion: payload.huesped_profesion,
          huesped_estado_civil: payload.huesped_estado_civil,
          huesped_procedencia: payload.huesped_procedencia,
          huesped_destino: payload.huesped_destino,
          motivo_viaje: payload.motivo_viaje,
          nacionalidad: payload.nacionalidad,
          tipo_documento: payload.tipo_documento
       }).eq("id", access.reservation_id);
       
       if (updateError) throw updateError;
       
       // Revocar token para que no se pueda volver a hacer auto-registro
       await db.from("guest_access_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", access.id);
       
       return Response.json({ success: true }, { headers: corsHeaders });
    }
    
    return errorResponse("Invalid action", 400);
  } catch (error) {
    console.error("[GUEST-PORTAL] Failed:", error);
    return errorResponse("Invalid guest link", 400);
  }
});
