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

function signingMaterialFor(hotel: Record<string, any>): { privateKeyPem: string; certPem: string } {
  const dbCertPem = hotel.sunat_certificado_pem;
  const privateKeyPem = Deno.env.get("SUNAT_CERT_PRIVATE_KEY_PEM");
  const certPem = dbCertPem || Deno.env.get("SUNAT_CERT_PEM");
  const allowTestCert = Deno.env.get("SUNAT_ALLOW_TEST_CERTIFICATE") === "true" && hotel.sunat_modo_prueba === true;
  if ((!privateKeyPem || !certPem) && !allowTestCert) {
    throw new Error("A real SUNAT certificate is required");
  }
  return privateKeyPem && certPem ? { privateKeyPem, certPem } : getOrCreateTestPfx();
}

function buildCredentials(hotel: Record<string, any>): Record<string, any> {
  const envRuc = Deno.env.get("SUNAT_RUC");
  const envUser = Deno.env.get("SUNAT_SOL_USERNAME");
  const envPassword = Deno.env.get("SUNAT_SOL_PASSWORD");
  return {
    ...hotel,
    ruc: envRuc || hotel.ruc,
    sunat_usuario_sol: envUser || hotel.sunat_usuario_sol,
    sunat_clave_sol: envPassword || hotel.sunat_clave_sol,
  };
}

function validateCredentials(credentials: Record<string, any>): void {
  const envRuc = Deno.env.get("SUNAT_RUC");
  if (envRuc && envRuc !== credentials.ruc) {
    throw new Error("SUNAT server credential tenant mismatch");
  }
  if (!credentials.ruc || !credentials.sunat_usuario_sol || !credentials.sunat_clave_sol) {
    throw new Error("SUNAT credentials are not configured server-side");
  }
  const envPassword = Deno.env.get("SUNAT_SOL_PASSWORD");
  if (!envPassword && String(credentials.sunat_clave_sol).startsWith("U2FsdGVkX1")) {
    throw new Error("Browser-encrypted SUNAT credentials are not usable by the server");
  }
}

function validateXmlStructure(xml: string, expectedRoot: string): void {
  if (!xml || xml.length === 0) throw new Error("Generated XML is empty");
  if (!xml.includes(`<${expectedRoot}`)) throw new Error(`Generated XML missing root <${expectedRoot}>`);
  const required = ["<cbc:UBLVersionID", "<cbc:ID", "<cac:TaxTotal", "<cac:LegalMonetaryTotal"];
  for (const el of required) {
    if (!xml.includes(el)) throw new Error(`Generated XML missing required element: ${el}`);
  }
}

async function persistXml(supabase: any, comprobanteId: number, unsignedXml: string, signedXml: string, zipBytes: Uint8Array): Promise<void> {
  const hash = forge.md.sha256.create().update(signedXml, "utf8").digest().toHex();
  const { data: existingXml } = await supabase.from("comprobante_xml").select("id")
    .eq("comprobante_id", comprobanteId).maybeSingle();
  const mutation = existingXml
    ? supabase.from("comprobante_xml").update({ xml: unsignedXml, hash, xml_firmado: signedXml, zip: zipBytes }).eq("id", existingXml.id)
    : supabase.from("comprobante_xml").insert({ comprobante_id: comprobanteId, xml: unsignedXml, hash, xml_firmado: signedXml, zip: zipBytes });
  const { error } = await mutation;
  if (error) throw error;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function serieFor(hotel: Record<string, any>, tipoDoc: string, originalTipoDoc?: string): string {
  switch (tipoDoc) {
    case "01": return hotel.serie_factura || "F001";
    case "03": return hotel.serie_boleta || "B001";
    case "07": return originalTipoDoc === "03" ? (hotel.serie_nc_boleta || "BC01") : (hotel.serie_nc_factura || "FC01");
    case "08": return originalTipoDoc === "03" ? (hotel.serie_nd_boleta || "BD01") : (hotel.serie_nd_factura || "FD01");
    default: return "F001";
  }
}

function buildDetalle(venta: Record<string, any>, sourceTable: string, baseTotal: number, divisor: number): { descripcion: string; cantidad: number; precio_unitario: number }[] {
  if (sourceTable === "ventas") {
    const noches = Number(venta.noches || 1);
    const precioNocheBase = round2(Number(venta.precio_noche || 0) / divisor);
    const hospedajeBase = round2(noches * precioNocheBase);
    const extrasBase = round2(baseTotal - hospedajeBase);
    if (extrasBase > 0.005 && hospedajeBase > 0.005) {
      return [
        { descripcion: "SERVICIO DE HOSPEDAJE", cantidad: noches, precio_unitario: precioNocheBase },
        { descripcion: "CONSUMOS Y SERVICIOS ADICIONALES", cantidad: 1, precio_unitario: extrasBase },
      ];
    }
    return [{ descripcion: "SERVICIO DE HOSPEDAJE / CONSUMO", cantidad: 1, precio_unitario: baseTotal }];
  }
  // POS: desglosa items cuando no hay descuento; con descuento usa línea única para no desbalancear.
  const descuento = Number(venta.descuento || 0);
  const items = Array.isArray(venta.items) ? venta.items : [];
  if (descuento <= 0.005 && items.length > 0) {
    const detalle = items
      .map((it: any) => ({
        descripcion: String(it.nombre || "PRODUCTO"),
        cantidad: Number(it.cantidad || 1),
        precio_unitario: round2(Number(it.precio_venta || 0) / divisor),
      }))
      .filter((d: any) => d.precio_unitario > 0 && d.cantidad > 0);
    if (detalle.length > 0) return detalle;
  }
  return [{ descripcion: "VENTA MINIMARKET", cantidad: 1, precio_unitario: baseTotal }];
}

async function populateDetalle(supabase: any, comprobanteId: number, detalle: { descripcion: string; cantidad: number; precio_unitario: number }[]): Promise<void> {
  if (detalle.length === 0) return;
  const rows = detalle.map((d) => ({
    comprobante_id: comprobanteId,
    descripcion: d.descripcion,
    cantidad: d.cantidad,
    precio_unitario: d.precio_unitario,
  }));
  const { error } = await supabase.from("comprobante_detalle").insert(rows);
  if (error) throw error;
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
    const supabase = createAdminClient();

    // ────────────────────────────────────────────────────────────────
    // Flujo de Nota de Crédito / Nota de Débito (referencia a comprobante)
    // ────────────────────────────────────────────────────────────────
    if (body.comprobante_ref_id) {
      const refId = Number(body.comprobante_ref_id);
      if (!Number.isInteger(refId) || refId <= 0) {
        return errorResponse("comprobante_ref_id must be a positive integer", 400);
      }
      const esCredito = body.tipo === "nota_credito";
      const esDebito = body.tipo === "nota_debito";
      if (!esCredito && !esDebito) {
        return errorResponse("tipo must be 'nota_credito' or 'nota_debito'", 400);
      }
      const tipoNota = String(body.tipo_nota || "").trim();
      if (!/^\d{2}$/.test(tipoNota)) {
        return errorResponse("tipo_nota (Catálogo 09) is required", 400);
      }

      const { data: original, error: originalError } = await supabase
        .from("comprobantes").select("*").eq("id", refId).single();
      if (originalError || !original) return errorResponse("Original comprobante not found", 404);
      if (auth.user.role !== "developer" && original.hotel_id !== auth.user.hotel_id) {
        return errorResponse("Access denied", 403);
      }
      if (original.estado !== "aceptado") {
        return errorResponse("Original comprobante must be accepted by SUNAT before issuing a nota", 409);
      }
      if (!["Factura", "Boleta"].includes(original.tipo)) {
        return errorResponse("Notas only supported for Factura or Boleta", 422);
      }

      const tipo = esCredito ? "Nota Credito" : "Nota Debito";
      const originalTipoDoc = original.tipo === "Factura" ? "01" : "03";

      const subtotal = Number(body.subtotal);
      const igv = Number(body.igv ?? 0);
      const total = Number(body.total);
      if (![subtotal, igv, total].every(Number.isFinite) || total <= 0) {
        return errorResponse("Nota amounts are invalid", 422);
      }

      const { data: hotelRows, error: hotelError } = await supabase.rpc("get_hotel_sunat_credentials", {
        p_hotel_id: original.hotel_id,
      });
      const hotel = hotelRows?.[0];
      if (hotelError || !hotel) return errorResponse("Hotel or SUNAT credentials not found", 404);
      const credentials = buildCredentials(hotel);
      validateCredentials(credentials);
      const serie = serieFor(hotel, esCredito ? "07" : "08", originalTipoDoc);

      const { data: existingNota } = await supabase.from("comprobantes").select("*")
        .eq("comprobante_ref_id", refId).eq("tipo", tipo).maybeSingle();
      if (existingNota && existingNota.estado === "aceptado") {
        return noStoreJson({ comprobante_id: existingNota.id, estado: existingNota.estado, idempotent: true, request_id: traceId }, 200, corsHeaders);
      }

      const { data: formattedNumber, error: numberError } = await supabase.rpc("next_comprobante_number", {
        p_hotel_id: original.hotel_id, p_tipo: tipo, p_serie: serie,
      });
      if (numberError || !formattedNumber) throw numberError || new Error("Could not allocate fiscal number");

      const { data: inserted, error: insertError } = await supabase.from("comprobantes").insert({
        hotel_id: original.hotel_id,
        tipo,
        serie,
        numero: formattedNumber,
        cliente_tipo: original.cliente_tipo,
        cliente_documento: original.cliente_documento,
        cliente_nombre: original.cliente_nombre,
        subtotal, igv, total,
        estado: "pendiente",
        comprobante_ref_id: refId,
        tipo_nota: tipoNota,
        motivo: String(body.motivo || "").trim() || null,
      }).select().single();
      if (insertError) throw insertError;

      const notaComp = { ...inserted, tipo, tipo_nota: tipoNota, motivo: body.motivo || "" };
      const unsignedXml = buildUblXml(notaComp, credentials, formattedNumber, [], {
        tipoDoc: originalTipoDoc,
        serie: original.serie,
        numero: original.numero,
      });
      validateXmlStructure(unsignedXml, esCredito ? "CreditNote" : "DebitNote");
      const signedXml = signXmlDocument(unsignedXml, signingMaterialFor(credentials));
      const zip = new JSZip();
      const fileName = `${credentials.ruc}-${esCredito ? "07" : "08"}-${serie}-${formattedNumber}`;
      zip.file(`${fileName}.xml`, signedXml);
      const zipBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
      await persistXml(supabase, inserted.id, unsignedXml, signedXml, zipBytes);

      logEvent("info", "fiscal_nota_queued", { request_id: traceId, comprobante_id: inserted.id, hotel_id: original.hotel_id, final_state: "pendiente" });
      return noStoreJson({ comprobante_id: inserted.id, estado: "pendiente", queued: true, request_id: traceId }, 202, corsHeaders);
    }

    // ────────────────────────────────────────────────────────────────
    // Flujo de Factura / Boleta (venta persistida)
    // ────────────────────────────────────────────────────────────────
    const ventaId = body.venta_id;
    const sourceTable = body.source === "ventas_pos" ? "ventas_pos" : body.source === "ventas" ? "ventas" : null;
    if (!isUuid(ventaId) || !sourceTable) {
      return errorResponse("venta_id (UUID) and source ('ventas' or 'ventas_pos') are required", 400);
    }

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
    const clienteTipo = rawType === "factura" ? "6" : (venta.huesped_dni ? "1" : "0");
    const clienteDocumento = rawType === "factura" ? venta.ruc_cliente : (venta.huesped_dni || "0");
    const clienteNombre = rawType === "factura" ? venta.razon_social : (venta.huesped_nombre || "CLIENTE VARIOS");
    if (rawType === "factura" && (!/^\d{11}$/.test(clienteDocumento || "") || !clienteNombre)) {
      return errorResponse("Stored invoice recipient is incomplete", 422);
    }

    const { data: hotelRows, error: hotelError } = await supabase.rpc("get_hotel_sunat_credentials", {
      p_hotel_id: venta.hotel_id,
    });
    const hotel = hotelRows?.[0];
    if (hotelError || !hotel) return errorResponse("Hotel or SUNAT credentials not found", 404);
    const credentials = buildCredentials(hotel);
    validateCredentials(credentials);

    const total = Number(venta.total);
    if (!Number.isFinite(total) || total <= 0) return errorResponse("Stored sale total is invalid", 422);
    const subtotal = hotel.aplica_igv === false ? total : Number((total / 1.18).toFixed(2));
    const igv = hotel.aplica_igv === false ? 0 : Number((total - subtotal).toFixed(2));
    const tipoDoc = rawType === "factura" ? "01" : "03";
    const serie = serieFor(hotel, tipoDoc);
    const divisor = hotel.aplica_igv === false ? 1 : 1.18;
    const detalle = buildDetalle(venta, sourceTable, subtotal, divisor);

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
        await populateDetalle(supabase, comp.id, detalle);
      }
    }

    const formattedNumber = comp.numero;
    const unsignedXml = buildUblXml(comp, credentials, formattedNumber, detalle);
    validateXmlStructure(unsignedXml, "Invoice");
    const signedXml = signXmlDocument(unsignedXml, signingMaterialFor(credentials));
    const zip = new JSZip();
    const fileName = `${credentials.ruc}-${tipo === "Factura" ? "01" : "03"}-${serie}-${formattedNumber}`;
    zip.file(`${fileName}.xml`, signedXml);
    const zipBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });
    await persistXml(supabase, comp.id, unsignedXml, signedXml, zipBytes);

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
