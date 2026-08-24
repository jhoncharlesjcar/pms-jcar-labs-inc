import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import forge from "npm:node-forge@1.3.1";
import JSZip from "npm:jszip@3.10.1";

import { buildUblXml } from "./xmlGenerator.ts";
import { getOrCreateTestPfx, signXmlDocument } from "./xmlSigner.ts";
import { authenticateRequest, errorResponse, createAdminClient, corsHeaders } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";

declare const Deno: any;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  const traceId = requestId(req);
  try {
    const auth = await authenticateRequest(req);
    if (auth.error || !auth.user) return errorResponse(auth.error || "Unauthorized", auth.status);
    if (!['recepcionista', 'admin', 'developer'].includes(auth.user.role)) {
      return errorResponse("Role not allowed to issue fiscal documents", 403);
    }

    const body = await req.json();
    const ventaId = body.venta_id;
    const sourceTable = body.source === "ventas_pos" ? "ventas_pos" : body.source === "ventas" ? "ventas" : null;
    if (!isUuid(ventaId) || !sourceTable) {
      return errorResponse("venta_id (UUID) and source ('ventas' or 'ventas_pos') are required", 400);
    }

    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("comprobantes").select("*")
      .eq("source_table", sourceTable).eq("source_id", ventaId).maybeSingle();
    if (existing && existing.estado === 'aceptado') {
      return noStoreJson({ comprobante_id: existing.id, estado: existing.estado, idempotent: true, request_id: traceId }, 200, corsHeaders);
    }
    if (existing && existing.estado === 'procesando') {
      return noStoreJson({ comprobante_id: existing.id, estado: existing.estado, queued: true, idempotent: true, request_id: traceId }, 202, corsHeaders);
    }
    if (existing && existing.estado === 'fallido') {
      return noStoreJson({ error: 'Fiscal document exhausted automatic retries and requires review', comprobante_id: existing.id, request_id: traceId }, 409, corsHeaders);
    }

    const { data: venta, error: ventaError } = await supabase
      .from(sourceTable).select("*").eq("id", ventaId).single();
    if (ventaError || !venta) return errorResponse("Venta not found", 404);
    if (auth.user.role !== "developer" && venta.hotel_id !== auth.user.hotel_id) {
      return errorResponse("Access denied", 403);
    }

    const rawType = String(venta.tipo_comprobante || "").toLowerCase();
    if (!['factura', 'boleta'].includes(rawType)) {
      return errorResponse("The stored sale does not request a supported fiscal document", 422);
    }
    const tipo = rawType === "factura" ? "Factura" : "Boleta";
    const serie = rawType === "factura" ? "F001" : "B001";
    const clienteTipo = rawType === "factura" ? "6" : (venta.huesped_dni ? "1" : "0");
    const clienteDocumento = rawType === "factura" ? venta.ruc_cliente : (venta.huesped_dni || "00000000");
    const clienteNombre = rawType === "factura" ? venta.razon_social : (venta.huesped_nombre || "CLIENTE VARIOS");
    if (rawType === "factura" && (!/^\d{11}$/.test(clienteDocumento || "") || !clienteNombre)) {
      return errorResponse("Stored invoice recipient is incomplete", 422);
    }

    const { data: hotelRows, error: hotelError } = await supabase.rpc("get_hotel_sunat_credentials", {
      p_hotel_id: venta.hotel_id,
    });
    const hotel = hotelRows?.[0];
    if (hotelError || !hotel) return errorResponse("Hotel or SUNAT credentials not found", 404);

    const envRuc = Deno.env.get("SUNAT_RUC");
    const envUser = Deno.env.get("SUNAT_SOL_USERNAME");
    const envPassword = Deno.env.get("SUNAT_SOL_PASSWORD");
    const dbPassword = hotel.sunat_clave_sol;
    const credentials = {
      ...hotel,
      ruc: envRuc || hotel.ruc,
      sunat_usuario_sol: envUser || hotel.sunat_usuario_sol,
      sunat_clave_sol: envPassword || dbPassword,
    };
    if (envRuc && envRuc !== hotel.ruc) return errorResponse("SUNAT server credential tenant mismatch", 503);
    if (!credentials.ruc || !credentials.sunat_usuario_sol || !credentials.sunat_clave_sol) {
      return errorResponse("SUNAT credentials are not configured server-side", 503);
    }
    if (!envPassword && String(dbPassword).startsWith("U2FsdGVkX1")) {
      return errorResponse("Browser-encrypted SUNAT credentials are not usable by the server", 503);
    }

    // P0-3 FIX: Per-hotel certificate from DB, with env var fallback (shared cert for now)
    const dbCertPem = hotel.sunat_certificado_pem;
    const privateKeyPem = Deno.env.get("SUNAT_CERT_PRIVATE_KEY_PEM");
    const certPem = dbCertPem || Deno.env.get("SUNAT_CERT_PEM");
    const allowTestCert = Deno.env.get("SUNAT_ALLOW_TEST_CERTIFICATE") === "true" && hotel.sunat_modo_prueba === true;
    if ((!privateKeyPem || !certPem) && !allowTestCert) {
      return errorResponse("A real SUNAT certificate is required", 503);
    }
    const signingMaterial = privateKeyPem && certPem
      ? { privateKeyPem, certPem }
      : getOrCreateTestPfx();

    const total = Number(venta.total);
    if (!Number.isFinite(total) || total <= 0) return errorResponse("Stored sale total is invalid", 422);
    const subtotal = hotel.aplica_igv === false ? total : Number((total / 1.18).toFixed(2));
    const igv = hotel.aplica_igv === false ? 0 : Number((total - subtotal).toFixed(2));

    let comp = existing;
    if (comp && ['rechazado', 'pendiente'].includes(comp.estado)) {
      const { data: requeued, error: requeueError } = await supabase.from('comprobantes').update({
        estado: 'pendiente', next_attempt_at: new Date().toISOString(), last_error: null,
      }).eq('id', comp.id).select().single();
      if (requeueError) throw requeueError;
      comp = requeued;
    }
    if (!comp) {
      const { data: formattedNumber, error: numberError } = await supabase.rpc("next_comprobante_number", {
        p_hotel_id: venta.hotel_id, p_tipo: tipo, p_serie: serie,
      });
      if (numberError || !formattedNumber) throw numberError || new Error("Could not allocate fiscal number");
      const { data: inserted, error: insertError } = await supabase.from("comprobantes").insert({
        hotel_id: venta.hotel_id, tipo, serie, numero: formattedNumber,
        cliente_tipo: clienteTipo, cliente_documento: clienteDocumento, cliente_nombre: clienteNombre,
        subtotal, igv, total, estado: "pendiente", source_table: sourceTable, source_id: ventaId,
      }).select().single();
      if (insertError?.code === "23505") {
        const { data: raced, error: racedError } = await supabase.from("comprobantes").select("*")
          .eq("source_table", sourceTable).eq("source_id", ventaId).single();
        if (racedError) throw racedError;
        comp = raced;
      } else if (insertError) {
        throw insertError;
      } else {
        comp = inserted;
      }
    }

    const formattedNumber = comp.numero;
    const unsignedXml = buildUblXml(comp, credentials, formattedNumber);
    const signedXml = signXmlDocument(unsignedXml, signingMaterial);
    const zip = new JSZip();
    const fileName = `${credentials.ruc}-${tipo === "Factura" ? "01" : "03"}-${serie}-${formattedNumber}`;
    zip.file(`${fileName}.xml`, signedXml);
    const zipBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
    const hash = forge.md.sha256.create().update(signedXml, "utf8").digest().toHex();
    const { data: existingXml } = await supabase.from("comprobante_xml").select("id")
      .eq("comprobante_id", comp.id).maybeSingle();
    const xmlMutation = existingXml
      ? supabase.from("comprobante_xml").update({ xml: unsignedXml, hash, xml_firmado: signedXml, zip: zipBytes }).eq("id", existingXml.id)
      : supabase.from("comprobante_xml").insert({ comprobante_id: comp.id, xml: unsignedXml, hash, xml_firmado: signedXml, zip: zipBytes });
    const { error: xmlError } = await xmlMutation;
    if (xmlError) throw xmlError;

    logEvent("info", "fiscal_document_queued", {
      request_id: traceId, comprobante_id: comp.id, hotel_id: venta.hotel_id,
      final_state: "pendiente",
    });
    return noStoreJson({ comprobante_id: comp.id, estado: "pendiente", queued: true, request_id: traceId }, 202, corsHeaders);
  } catch (error) {
    logEvent("error", "fiscal_document_failed", { request_id: traceId, error: error instanceof Error ? error.message : String(error) });
    return noStoreJson({ error: "Fiscal document processing failed", request_id: traceId }, 500, corsHeaders);
  }
});
