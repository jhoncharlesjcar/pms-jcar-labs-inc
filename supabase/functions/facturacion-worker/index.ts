import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateCronJob, corsHeaders, createAdminClient, errorResponse } from "../_shared/auth-middleware.ts";
import { logEvent, noStoreJson, requestId } from "../_shared/runtime.ts";
import { sendSunatSoap } from "../facturacion/sunatSoapClient.ts";

declare const Deno: any;

function zipAsBase64(value: unknown): string {
  if (typeof value === 'string') {
    const hex = value.startsWith('\\x') ? value.slice(2) : null;
    if (hex !== null) {
      if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
        throw new Error('stored_fiscal_zip_hex_is_invalid');
      }
      const bytes = new Uint8Array(hex.length / 2);
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
      }
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    }
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) return value;
    throw new Error('stored_fiscal_zip_base64_is_invalid');
  }
  if (Array.isArray(value)) {
    const bytes = Uint8Array.from(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }
  throw new Error('stored_fiscal_zip_is_invalid');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);
  const auth = authenticateCronJob(req);
  if (!auth.valid) return errorResponse(auth.error || 'Unauthorized', 401);
  const traceId = requestId(req);
  const workerId = `sunat-${crypto.randomUUID()}`;
  const db = createAdminClient();
  try {
    const { data: jobs, error: claimError } = await db.rpc('claim_facturacion_jobs', {
      p_worker_id: workerId,
      p_limit: 3,
      p_lease_seconds: 300,
    });
    if (claimError) throw claimError;
    const results = [];
    for (const job of jobs || []) {
      try {
        const { data: hotelRows, error: hotelError } = await db.rpc('get_hotel_sunat_credentials', {
          p_hotel_id: job.hotel_id,
        });
        const hotel = hotelRows?.[0];
        if (hotelError || !hotel) throw hotelError || new Error('sunat_credentials_not_found');
        const envRuc = Deno.env.get('SUNAT_RUC');
        if (envRuc && envRuc !== hotel.ruc) throw new Error('sunat_server_credential_tenant_mismatch');
        const credentials = {
          ...hotel,
          ruc: envRuc || hotel.ruc,
          sunat_usuario_sol: Deno.env.get('SUNAT_SOL_USERNAME') || hotel.sunat_usuario_sol,
          sunat_clave_sol: Deno.env.get('SUNAT_SOL_PASSWORD') || hotel.sunat_clave_sol,
        };
        if (!credentials.ruc || !credentials.sunat_usuario_sol || !credentials.sunat_clave_sol) {
          throw new Error('sunat_credentials_not_configured');
        }
        const { data: xml, error: xmlError } = await db.from('comprobante_xml')
          .select('zip').eq('comprobante_id', job.id).single();
        if (xmlError || !xml?.zip) throw xmlError || new Error('signed_fiscal_xml_not_found');
        const typeCode = String(job.tipo).toLowerCase() === 'factura' ? '01' : '03';
        const fileName = `${credentials.ruc}-${typeCode}-${job.serie}-${job.numero}`;
        const result = await sendSunatSoap(credentials, fileName, zipAsBase64(xml.zip));
        await db.from('sunat_envios').insert({
          comprobante_id: job.id,
          ticket: result.ticket,
          estado: result.estadoFinal,
          respuesta: JSON.stringify({ detalle: result.messageResult, status: result.soapResponseStatus }),
        });
        if (result.estadoFinal === 'aceptado') {
          if (result.base64Cdr) {
            const { data: currentCdr } = await db.from('cdr').select('id').eq('comprobante_id', job.id).maybeSingle();
            const mutation = currentCdr
              ? db.from('cdr').update({ codigo: '0', descripcion: result.messageResult, archivo_xml: result.base64Cdr }).eq('id', currentCdr.id)
              : db.from('cdr').insert({ comprobante_id: job.id, codigo: '0', descripcion: result.messageResult, archivo_xml: result.base64Cdr });
            const { error } = await mutation;
            if (error) throw error;
          }
          const { data: acked, error: ackError } = await db.rpc('ack_facturacion_job', {
            p_comprobante_id: job.id, p_worker_id: workerId, p_estado: 'aceptado',
          });
          if (ackError || !acked) throw ackError || new Error('fiscal_job_lease_lost');
          results.push({ comprobante_id: job.id, status: 'accepted' });
        } else {
          const permanent = result.soapResponseStatus >= 400 && result.soapResponseStatus < 500;
          await db.rpc('nack_facturacion_job', {
            p_comprobante_id: job.id, p_worker_id: workerId,
            p_error: result.messageResult, p_permanent: permanent,
          });
          results.push({ comprobante_id: job.id, status: permanent ? 'failed' : 'retry_scheduled' });
        }
      } catch (error) {
        await db.rpc('nack_facturacion_job', {
          p_comprobante_id: job.id, p_worker_id: workerId,
          p_error: error instanceof Error ? error.message : String(error), p_permanent: false,
        });
        results.push({ comprobante_id: job.id, status: 'retry_scheduled' });
      }
    }
    logEvent('info', 'facturacion_worker_completed', { request_id: traceId, claimed: (jobs || []).length, results });
    return noStoreJson({ success: true, results, request_id: traceId }, 200, corsHeaders);
  } catch (error) {
    logEvent('error', 'facturacion_worker_failed', {
      request_id: traceId, error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Fiscal retry worker failed', 500);
  }
});
