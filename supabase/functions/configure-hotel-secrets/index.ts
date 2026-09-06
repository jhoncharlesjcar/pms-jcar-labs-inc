import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateRequest, corsHeaders, createAdminClient, errorResponse } from "../_shared/auth-middleware.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);
  const auth = await authenticateRequest(req);
  if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);
  if (!['admin', 'developer'].includes(auth.user.role)) return errorResponse("Administrator role required", 403);
  try {
    const body = await req.json();
    const hotelId = String(body.hotel_id || auth.user.hotel_id || "");
    if (auth.user.role !== "developer" && hotelId !== auth.user.hotel_id) return errorResponse("Cross-tenant update denied", 403);
    const values = {
      sunat: typeof body.sunat_clave_sol === "string" ? body.sunat_clave_sol.trim() : null,
      cert: typeof body.sunat_certificado_pem === "string" ? body.sunat_certificado_pem.trim() : null,
      certKey: typeof body.sunat_cert_private_key_pem === "string" ? body.sunat_cert_private_key_pem.trim() : null,
      gateway: typeof body.pasarela_private_key === "string" ? body.pasarela_private_key.trim() : null,
    };
    if (!values.sunat && !values.cert && !values.certKey && !values.gateway) return errorResponse("At least one secret is required", 400);
    if (
      (values.sunat?.length || 0) > 512 ||
      (values.cert?.length || 0) > 32768 ||
      (values.certKey?.length || 0) > 32768 ||
      (values.gateway?.length || 0) > 2048
    ) {
      return errorResponse("Secret exceeds allowed size", 400);
    }
    const db = createAdminClient();
    const { error } = await db.rpc("set_hotel_secrets", {
      p_hotel_id: hotelId,
      p_sunat_clave_sol: values.sunat,
      p_sunat_certificado_pem: values.cert,
      p_pasarela_private_key: values.gateway,
      p_sunat_cert_private_key_pem: values.certKey,
    });
    if (error) throw error;
    return Response.json({ success: true, configured: {
      sunat_clave_sol: Boolean(values.sunat),
      sunat_certificado_pem: Boolean(values.cert),
      sunat_cert_private_key_pem: Boolean(values.certKey),
      pasarela_private_key: Boolean(values.gateway),
    } }, { headers: corsHeaders });
  } catch (error) {
    console.error("[SECRETS] Configuration failed:", error);
    return errorResponse("Could not configure hotel secrets", 500);
  }
});
