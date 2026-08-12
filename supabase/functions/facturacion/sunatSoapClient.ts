declare const Deno: any;

export async function sendSunatSoap(
  hotel: any, 
  fileName: string, 
  base64Zip: string
): Promise<{ estadoFinal: string; messageResult: string; ticket: string; base64Cdr?: string; soapResponseStatus: number; responseText: string }> {
  
  const isSandbox = hotel.sunat_usuario_sol.toUpperCase().includes("MODODATOS") || hotel.ruc.startsWith("2060");
  const sunatSoapUrl = isSandbox
    ? "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService"
    : (Deno.env.get("SUNAT_ENDPOINT") || "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService");

  const soapEnvelope = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">` +
    `<soapenv:Header>` +
    `<wsse:Security>` +
    `<wsse:UsernameToken>` +
    `<wsse:Username>${hotel.ruc}${hotel.sunat_usuario_sol.toUpperCase()}</wsse:Username>` +
    `<wsse:Password>${hotel.sunat_clave_sol}</wsse:Password>` +
    `</wsse:UsernameToken>` +
    `</wsse:Security>` +
    `</soapenv:Header>` +
    `<soapenv:Body>` +
    `<ser:sendBill>` +
    `<fileName>${fileName}.zip</fileName>` +
    `<contentFile>${base64Zip}</contentFile>` +
    `</ser:sendBill>` +
    `</soapenv:Body>` +
    `</soapenv:Envelope>`;

  console.log(`Sending invoice ${fileName} to SUNAT SOAP endpoint: ${sunatSoapUrl}`);

  const soapResponse = await fetch(sunatSoapUrl, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml;charset=utf-8",
      "SOAPAction": "urn:sendBill",
    },
    body: soapEnvelope,
  });

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

  return { estadoFinal, messageResult, ticket, base64Cdr, soapResponseStatus: soapResponse.status, responseText };
}
