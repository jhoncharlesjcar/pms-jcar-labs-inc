import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";

declare const Deno: any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function dates(input: any): { start: Date; end: Date; nights: number } | null {
  if (!datePattern.test(input.fecha_entrada) || !datePattern.test(input.fecha_salida)) return null;
  const start = new Date(`${input.fecha_entrada}T00:00:00Z`);
  const end = new Date(`${input.fecha_salida}T00:00:00Z`);
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (!Number.isFinite(nights) || nights < 1 || nights > 30 || start < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) return null;
  return { start, end, nights };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  if (Deno.env.get("PUBLIC_BOOKING_ENABLED") !== "true") return errorResponse("Public booking is disabled", 503);

  try {
    const body = await req.json();
    if (!uuidPattern.test(body.hotel_id || "")) return errorResponse("Invalid hotel_id", 400);
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const { data: hotel, error: hotelError } = await db.from("hoteles")
      .select("id,nombre,ciudad").eq("id", body.hotel_id).eq("activo", true).single();
    if (hotelError || !hotel) return errorResponse("Hotel not available", 404);
    if (body.action === "hotel") return Response.json({ hotel }, { headers: corsHeaders });

    const range = dates(body);
    if (!range) return errorResponse("Invalid date range", 400);

    const { data: rooms, error: roomError } = await db.from("habitaciones")
      .select("id,numero,tipo,descripcion,capacidad,precio_noche,precio")
      .eq("hotel_id", body.hotel_id).neq("estado", "mantenimiento");
    if (roomError) throw roomError;
    const { data: occupied, error: occupiedError } = await db.from("reservas")
      .select("habitacion_id").eq("hotel_id", body.hotel_id)
      .in("estado", ["pendiente", "activa"])
      .lt("fecha_entrada", body.fecha_salida).gt("fecha_salida", body.fecha_entrada);
    if (occupiedError) throw occupiedError;
    const occupiedIds = new Set((occupied || []).map((r: any) => r.habitacion_id));
    const available = (rooms || []).filter((r: any) => !occupiedIds.has(r.id)).map((r: any) => ({
      id: r.id, numero: r.numero, tipo: r.tipo, descripcion: r.descripcion,
      capacidad: r.capacidad, precio_noche: Number(r.precio_noche ?? r.precio),
      total: Number((Number(r.precio_noche ?? r.precio) * range.nights).toFixed(2)),
    }));
    if (body.action === "availability") return Response.json({ rooms: available, extras: [] }, { headers: corsHeaders });
    if (body.action !== "create") return errorResponse("Unsupported action", 400);

    if (!uuidPattern.test(body.habitacion_id || "")) return errorResponse("Invalid habitacion_id", 400);
    const room = available.find((r: any) => r.id === body.habitacion_id);
    if (!room) return errorResponse("Room is no longer available", 409);
    const guest = body.huesped || {};
    const name = String(guest.nombre || "").trim();
    const document = String(guest.documento || "").trim();
    const phone = String(guest.telefono || "").trim();
    const email = String(guest.email || "").trim();
    if (name.length < 3 || name.length > 150 || !/^[A-Za-z0-9-]{6,20}$/.test(document) || phone.length < 6 || phone.length > 30 || email.length > 254) {
      return errorResponse("Invalid guest data", 400);
    }

    const reservationNumber = `WEB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: reservation, error: insertError } = await db.from("reservas").insert({
      hotel_id: body.hotel_id, habitacion_id: room.id, habitacion_numero: room.numero,
      habitacion_tipo: room.tipo, huesped_nombre: name, huesped_dni: document,
      huesped_telefono: phone, huesped_email: email || null,
      fecha_entrada: body.fecha_entrada, fecha_salida: body.fecha_salida,
      noches: range.nights, precio_noche: room.precio_noche, total: room.total,
      estado: "pendiente", numero_reserva: reservationNumber, origen: "booking_engine",
    }).select("id,numero_reserva,estado,total").single();
    if (insertError) {
      if (insertError.code === "23P01") return errorResponse("Room is no longer available", 409);
      throw insertError;
    }

    const portalToken = randomToken();
    const checkinToken = randomToken();
    const expires = new Date(range.end.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const { error: tokenError } = await db.from("guest_access_tokens").insert([
      { reservation_id: reservation.id, token_hash: await sha256(portalToken), scope: "portal", expires_at: expires },
      { reservation_id: reservation.id, token_hash: await sha256(checkinToken), scope: "checkin", expires_at: expires },
    ]);
    if (tokenError) {
      await db.from("reservas").delete().eq("id", reservation.id);
      throw tokenError;
    }

    return Response.json({
      reservation,
      links: { portal_token: portalToken, checkin_token: checkinToken },
    }, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("[PUBLIC-BOOKING] Failed:", error);
    return errorResponse("Booking request failed", 500);
  }
});
