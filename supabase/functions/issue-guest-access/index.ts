import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

declare const Deno: any;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const traceId = requestId(req);
  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || 'Unauthorized', auth.status);
  if (!['recepcionista', 'admin', 'developer'].includes(auth.user.role)) return errorResponse('Role not allowed', 403);

  try {
    const { reservation_id: reservationId } = await req.json();
    if (!uuidPattern.test(String(reservationId || ''))) return errorResponse('Invalid reservation_id', 400);
    const appUrl = (Deno.env.get('PUBLIC_APP_URL') || '').replace(/\/$/, '');
    if (!/^https:\/\/[A-Za-z0-9.-]+(?::\d+)?$/.test(appUrl)) {
      return errorResponse('Public application URL is not configured', 503);
    }
    const db = createAdminClient();
    const { data: reservation, error: reservationError } = await db.from('reservas')
      .select('id,hotel_id,estado').eq('id', reservationId).single();
    if (reservationError || !reservation) return errorResponse('Reservation not found', 404);
    if (auth.user.role !== 'developer' && auth.user.hotel_id !== reservation.hotel_id) {
      return errorResponse('Cross-tenant access denied', 403);
    }
    if (!['confirmada', 'activa'].includes(reservation.estado)) {
      return errorResponse('Only confirmed reservations can receive guest links', 409);
    }
    const { data: tokens, error: tokenError } = await db.rpc('ai_rotate_guest_access_tokens', {
      p_reservation_id: reservation.id,
    });
    if (tokenError || !tokens) throw tokenError || new Error('guest_access_token_generation_failed');
    logEvent('info', 'guest_access_issued', {
      request_id: traceId, reservation_id: reservation.id, hotel_id: reservation.hotel_id,
      expires_at: tokens.expires_at,
    });
    return noStoreJson({
      reservation_id: reservation.id,
      portal_url: `${appUrl}/portal/${tokens.portal_token}`,
      checkin_url: `${appUrl}/public-checkin/${tokens.checkin_token}`,
      expires_at: tokens.expires_at,
      request_id: traceId,
    }, 201, { ...corsHeaders, 'X-Request-Id': traceId });
  } catch (error) {
    logEvent('error', 'guest_access_issue_failed', {
      request_id: traceId, error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Could not issue guest access', 500);
  }
});
