import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.0";
import { corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";
import { fetchWithPolicy, logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

declare const Deno: any;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idempotencyPattern = /^[A-Za-z0-9._:-]{16,100}$/;

function validGuestDocument(type: string, value: string): boolean {
  const normalized = type.trim().toUpperCase();
  if (normalized === 'DNI') return /^\d{8}$/.test(value);
  if (normalized === 'RUC') return /^\d{11}$/.test(value);
  if (normalized === 'CE') return /^[A-Z0-9-]{4,15}$/i.test(value);
  if (normalized === 'PASAPORTE') return /^[A-Z0-9-]{6,15}$/i.test(value);
  return false;
}

async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyHumanChallenge(token: unknown, remoteIp: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
  if (!secret) return false;
  if (typeof token !== 'string' || token.length < 20 || token.length > 2048) return false;
  const form = new URLSearchParams({ secret, response: token, remoteip: remoteIp });
  const response = await fetchWithPolicy('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  }, { timeoutMs: 5_000, attempts: 2 });
  if (!response.ok) return false;
  const result = await response.json();
  return result?.success === true;
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
    const correlationId = requestId(req);
    const clientIp = req.headers.get('cf-connecting-ip')?.trim()
      || req.headers.get('x-real-ip')?.trim()
      || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || "unknown-ip";
    const body = await req.json();
    if (!uuidPattern.test(body.hotel_id || "")) return errorResponse("Invalid hotel_id", 400);
    const action = String(body.action || '');
    const ipHash = await sha256(`booking:${clientIp}:${body.hotel_id}:${action}`);
    const hotelHash = await sha256(`booking:hotel:${body.hotel_id}:${action}`);

    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // P1: Rate limiting per IP (10 requests per 5 minutes)
    const { data: allowed, error: rateLimitError } = await db.rpc("check_booking_rate_limit", {
      p_ip_hash: ipHash,
      p_max_attempts: 15,
      p_window_seconds: 300,
    });
    if (rateLimitError || allowed === false) {
      return errorResponse("Too many booking requests. Please try again in a few minutes.", 429);
    }
    const { data: hotelAllowed, error: hotelRateError } = await db.rpc("check_booking_rate_limit", {
      p_ip_hash: hotelHash,
      p_max_attempts: 500,
      p_window_seconds: 300,
    });
    if (hotelRateError || hotelAllowed === false) return errorResponse("Booking service is temporarily busy", 429);

    const { data: hotel, error: hotelError } = await db.from("hoteles")
      .select("id,nombre,ciudad").eq("id", body.hotel_id).eq("activo", true).single();
    if (hotelError || !hotel) return errorResponse("Hotel not available", 404);
    if (body.action === "hotel") return noStoreJson({ hotel }, 200, corsHeaders);

    if (body.action === "identity") return errorResponse("Public identity lookup has been removed", 410);

    const range = dates(body);
    if (!range) return errorResponse("Invalid date range", 400);
    const adults = Number(body.adultos ?? body.huespedes ?? 1);
    const children = Number(body.ninos ?? 0);
    if (!Number.isInteger(adults) || adults < 1 || adults > 20 || !Number.isInteger(children) || children < 0 || children > 20) {
      return errorResponse("Invalid occupancy", 400);
    }

    const { data: availability, error: availabilityError } = await db.rpc("ai_search_availability_v2", {
      p_hotel_id: body.hotel_id,
      p_fecha_entrada: body.fecha_entrada,
      p_fecha_salida: body.fecha_salida,
      p_adultos: adults,
      p_ninos: children,
    });
    if (availabilityError) throw availabilityError;
    const available = (availability?.rooms || []).map((room: any) => ({
      id: room.habitacion_id,
      numero: room.room_number,
      tipo: room.room_type,
      descripcion: room.description,
      amenidades: room.amenities,
      capacidad: room.capacity,
      precio_noche: Number(room.nightly_rate),
      total: Number(room.total),
      price_breakdown: room.breakdown,
    }));
    if (body.action === "availability") return noStoreJson({ rooms: available, extras: [] }, 200, corsHeaders);
    if (body.action !== "create") return errorResponse("Unsupported action", 400);

    if (!await verifyHumanChallenge(body.challenge_token, clientIp)) {
      return errorResponse("Human verification is required", 403);
    }

    if (!uuidPattern.test(body.habitacion_id || "")) return errorResponse("Invalid habitacion_id", 400);
    const room = available.find((r: any) => r.id === body.habitacion_id);
    if (!room) return errorResponse("Room is no longer available", 409);
    const guest = body.huesped || {};
    const name = String(guest.nombre || "").trim();
    const document = String(guest.documento || "").trim();
    const phone = String(guest.telefono || "").trim();
    const email = String(guest.email || "").trim();
    const documentType = String(guest.tipo_documento || 'DNI').trim().toUpperCase();

    if (name.length < 3 || name.length > 150 || !validGuestDocument(documentType, document) || phone.length < 6 || phone.length > 30) {
      return errorResponse("Invalid guest data", 400);
    }
    if (email && !emailPattern.test(email)) {
      return errorResponse("Invalid email format", 400);
    }
    const idempotencyKey = String(body.idempotency_key || req.headers.get('x-idempotency-key') || '');
    const sessionId = String(body.session_id || '');
    if (!idempotencyPattern.test(idempotencyKey) || !uuidPattern.test(sessionId)) {
      return errorResponse('Valid session_id and idempotency_key are required', 400);
    }
    const method = String(body.payment_method || 'yape').toLowerCase();
    if (!['yape', 'plin', 'transferencia', 'tarjeta', 'efectivo'].includes(method)) {
      return errorResponse('Unsupported payment method', 400);
    }

    const { data: checkout, error: checkoutError } = await db.rpc('create_public_booking_checkout', {
      p_hotel_id: body.hotel_id,
      p_session_id: sessionId,
      p_idempotency_key: idempotencyKey,
      p_habitacion_id: room.id,
      p_fecha_entrada: body.fecha_entrada,
      p_fecha_salida: body.fecha_salida,
      p_adultos: adults,
      p_ninos: children,
      p_guest_name: name,
      p_guest_phone: phone,
      p_guest_document: document,
      p_guest_email: email || null,
      p_guest_document_type: documentType,
      p_payment_method: method,
    });
    if (checkoutError) {
      if (checkoutError.code === '23P01' || /no longer available/i.test(checkoutError.message || '')) {
        return errorResponse('Room is no longer available', 409);
      }
      throw checkoutError;
    }
    logEvent('info', 'public_booking_hold_created', {
      request_id: correlationId,
      hotel_id: body.hotel_id,
      conversation_id: checkout?.conversation_id,
    });
    return Response.json(checkout, {
      status: checkout?.idempotent ? 200 : 201,
      headers: { ...corsHeaders, 'Cache-Control': 'no-store', 'X-Request-Id': correlationId },
    });
  } catch (error) {
    logEvent('error', 'public_booking_failed', { error: error instanceof Error ? error.message.slice(0, 160) : 'unknown_error' });
    return errorResponse("Booking request failed", 500);
  }
});
