// @ts-nocheck
// supabase/functions/facturacion/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forge from "npm:node-forge@1.3.1";
import JSZip from "npm:jszip@3.10.1";

import { buildUblXml } from "./xmlGenerator.ts";
import { getOrCreateTestPfx, signXmlDocument } from "./xmlSigner.ts";
import { sendSunatSoap } from "./sunatSoapClient.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const payload = body.payload || body;

    if (!payload || !payload.hotel_id) {
      throw new Error("Missing payload or hotel_id in request body");
    }

    // Securely query with SERVICE ROLE key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: hotelList, error: hotelErr } = await supabase
      .rpc("get_hotel_sunat_credentials", { p_hotel_id: payload.hotel_id });

    if (hotelErr) throw hotelErr;
    if (!hotelList || hotelList.length === 0) {
      throw new Error("El hotel no existe en la base de datos.");
    }
    const hotel = hotelList[0];
    if (!hotel.ruc || !hotel.ruc.trim() || !hotel.sunat_usuario_sol || !hotel.sunat_usuario_sol.trim() || !hotel.sunat_clave_sol) {
      throw new Error("El hotel no tiene configurado el RUC, Usuario SOL o Clave SOL en la sección de Configuración.");
    }

    let rawNumber = payload.numero || "";
    if (rawNumber.includes("-")) {
      rawNumber = rawNumber.split("-")[1];
    }
    const cleanDigits = rawNumber.replace(/\D/g, "");
    const formattedNumber = cleanDigits.slice(-8).padStart(8, "0");

    const { data: comp, error: insertErr } = await supabase
      .from("comprobantes")
      .insert({
        hotel_id: payload.hotel_id,
        tipo: payload.tipo ?? "Factura",
        serie: payload.serie ?? "F001",
        numero: formattedNumber,
        cliente_tipo: payload.cliente_tipo,
        cliente_documento: payload.cliente_documento,
        cliente_nombre: payload.cliente_nombre,
        subtotal: payload.subtotal || 0,
        igv: payload.igv || 0,
        total: payload.total || 0,
        estado: "pendiente",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // 1. Generate XML
    const unsignedXml = buildUblXml(comp, hotel, formattedNumber);

    // 2. Sign XML
    const pfxCache = getOrCreateTestPfx();
    const signedXml = signXmlDocument(unsignedXml, pfxCache);

    // 3. Compress
    const zip = new JSZip();
    const fileName = `${hotel.ruc}-${comp.tipo === "Factura" ? "01" : "03"}-${comp.serie}-${formattedNumber}`;
    zip.file(`${fileName}.xml`, signedXml);
    const zipBytes: Uint8Array = await zip.generateAsync({ type: "uint8array" });

    // Store in db
    const hashHex = forge.md.sha256.create().update(signedXml, "utf8").digest().toHex();
    await supabase.from("comprobante_xml").insert({
      comprobante_id: comp.id,
      xml: unsignedXml,
      hash: hashHex,
      xml_firmado: signedXml,
      zip: zipBytes,
    });

    // 4. Send to SUNAT
    const base64Zip = forge.util.encode64(Array.from(zipBytes).map(b => String.fromCharCode(b)).join(""));
    const sunatResult = await sendSunatSoap(hotel, fileName, base64Zip);

    if (sunatResult.base64Cdr) {
      await supabase.from("cdr").insert({
        comprobante_id: comp.id,
        codigo: "0",
        descripcion: sunatResult.messageResult,
        archivo_xml: sunatResult.base64Cdr,
      });
    }

    await supabase.from("comprobantes").update({ estado: sunatResult.estadoFinal }).eq("id", comp.id);

    await supabase.from("sunat_envios").insert({
      comprobante_id: comp.id,
      ticket: sunatResult.ticket,
      estado: sunatResult.estadoFinal,
      respuesta: JSON.stringify({ detalle: sunatResult.messageResult, status: sunatResult.soapResponseStatus, body: sunatResult.responseText.slice(0, 1000) }),
    });

    if (sunatResult.estadoFinal !== "aceptado") {
      throw new Error(sunatResult.messageResult);
    }

    return new Response(JSON.stringify({ comprobante_id: comp.id, estado: sunatResult.estadoFinal, detalle: sunatResult.messageResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const err = e as any;
    return new Response(JSON.stringify({ error: err?.message ?? "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
