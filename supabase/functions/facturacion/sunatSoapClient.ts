declare const Deno: any;

import { fetchWithPolicy, logEvent } from "../_shared/runtime.ts";

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function sendSunatSoap(
  hotel: any, 
  fileName: string, 
  base64Zip: string
): Promise<{ estadoFinal: string; messageResult: string; ticket: string; base64Cdr?: string; soapResponseStatus: number; responseText: string }> {
  
  // P0-2 FIX: Use the explicit sunat_modo_prueba flag, NOT RUC prefix.
  // Default to sandbox (true) when flag is undefined — fail safe.
  const isSandbox = hotel.sunat_modo_prueba !== false;
  if (hotel.sunat_modo_prueba === undefined || hotel.sunat_modo_prueba === null) {
    logEvent("warn", "sunat_mode_defaulted", { sandbox: true });
  }
  const sunatSoapUrl = isSandbox
    ? "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService"
    : (Deno.env.get("SUNAT_ENDPOINT") || "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService");

  const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">` +
    `<soapenv:Header>` +
    `<wsse:Security>` +
    `<wsse:UsernameToken>` +
    `<wsse:Username>${escapeXml(hotel.ruc)}${escapeXml(String(hotel.sunat_usuario_sol).toUpperCase())}</wsse:Username>` +
    `<wsse:Password>${escapeXml(hotel.sunat_clave_sol)}</wsse:Password>` +
    `</wsse:UsernameToken>` +
    `</wsse:Security>` +
    `</soapenv:Header>` +
    `<soapenv:Body>` +
    `<ser:sendBill>` +
    `<fileName>${escapeXml(fileName)}.zip</fileName>` +
    `<contentFile>${base64Zip}</contentFile>` +
    `</ser:sendBill>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`;

  logEvent("info", "sunat_send_started", { file_name: fileName, sandbox: isSandbox });

  const soapResponse = await fetchWithPolicy(sunatSoapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=utf-8",
      "SOAPAction": "urn:sendBill",
    },
    body: soapEnvelope,
  }, { timeoutMs: 15_000, attempts: 2 });

  const responseText = await soapResponse.text();
  let estadoFinal = "rechazado";
  let messageResult = "Error desconocido de SUNAT";
  let ticket = "NO_TICKET";
  let base64Cdr: string | undefined = undefined;

  if (soapResponse.ok) {
    if (responseText.includes("<faultstring>")) {
      const faultCode = responseText.match(/<faultcode>(.*?)<\/faultcode>/)?.[1] || "Client";
      const faultString = responseText.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || "Error en validación";
      messageResult = `SUNAT SOAP Fault [${faultCode}]: ${faultString}`;
    } else {
      // Successful response - extract CDR Zip base64
      const cdrMatch = responseText.match(/<applicationResponse>(.*?)<\/applicationResponse>/);
      if (cdrMatch && cdrMatch[1]) {
        base64Cdr = cdrMatch[1].trim();
        estadoFinal = "aceptado";
        messageResult = "Comprobante aceptado por SUNAT (CDR recibido)";
        ticket = `CDR_${Date.now()}`;
      } else {
        messageResult = "Respuesta de SUNAT sin datos CDR de constancia";
      }
    }
  } else {
    if (responseText.includes("<faultstring>")) {
      const faultString = responseText.match(/<faultstring>(.*?)<\/faultstring>/)?.[1] || "Error";
      messageResult = `Error SUNAT [HTTP ${soapResponse.status}]: ${faultString}`;
    } else {
      messageResult = `Error de conexión SUNAT: HTTP ${soapResponse.status}`;
    }
  }

  logEvent(estadoFinal === "aceptado" ? "info" : "warn", "sunat_send_finished", {
    file_name: fileName,
    sandbox: isSandbox,
    http_status: soapResponse.status,
    final_state: estadoFinal,
    received_cdr: Boolean(base64Cdr),
  });
  return { estadoFinal, messageResult, ticket, base64Cdr, soapResponseStatus: soapResponse.status, responseText };
}
