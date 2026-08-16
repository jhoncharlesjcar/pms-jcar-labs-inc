import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, createAdminClient, corsHeaders, errorResponse } from "../_shared/auth-middleware.ts";

declare const Deno: any;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);
  if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse("Administrator role required", 403);

  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "");
    const hotelId = String(body.hotel_id || "");
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254 || !uuidPattern.test(hotelId)) {
      return errorResponse("Invalid invitation data", 400);
    }
    if (!['recepcionista', 'limpieza', 'admin'].includes(role)) return errorResponse("Invalid role", 400);
    if (auth.user.role === 'admin' && hotelId !== auth.user.hotel_id) return errorResponse("Cross-tenant invitation denied", 403);

    const db = createAdminClient();
    const { data: hotel, error: hotelError } = await db.from("hoteles").select("id").eq("id", hotelId).single();
    if (hotelError || !hotel) return errorResponse("Hotel not found", 404);

    const redirectTo = Deno.env.get("INVITE_REDIRECT_URL");
    if (!redirectTo) return errorResponse("Invitation redirect is not configured", 503);
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: "" },
    });
    if (error || !data.user) {
      console.warn("[INVITE] Auth invitation failed:", error?.message);
      return errorResponse("Could not send invitation", 400);
    }

    const { error: profileError } = await db.from("usuarios").upsert({
      id: data.user.id, email, role, hotel_id: hotelId, activo: true,
    }, { onConflict: "id" });
    if (profileError) {
      await db.auth.admin.deleteUser(data.user.id);
      throw profileError;
    }
    return Response.json({ success: true, user: { id: data.user.id, email, role, hotel_id: hotelId } }, {
      status: 201, headers: corsHeaders,
    });
  } catch (error) {
    console.error("[INVITE] Failed:", error);
    return errorResponse("Invitation failed", 500);
  }
});
