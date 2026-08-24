// @ts-nocheck: bypassing strict type checks for Identity endpoint
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { authenticateRequest, errorResponse, createAdminClient } from '../_shared/auth-middleware.ts';
import { fetchWithPolicy, logEvent, requestId } from '../_shared/runtime.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Validaciones
const DniSchema = z.string().regex(/^\d{8}$/, "El DNI debe tener 8 dígitos numéricos");
const RucSchema = z.string().regex(/^\d{11}$/, "El RUC debe tener 11 dígitos numéricos");

// Validador Módulo 11 para RUC Peruano
function validarRUC(ruc: string): boolean {
  if (ruc.length !== 11) return false;
  
  const prefijo = ruc.substring(0, 2);
  if (!["10", "15", "17", "20"].includes(prefijo)) {
    return false; // RUCs válidos empiezan con estos prefijos
  }

  let suma = 0;
  const multiplicadores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  
  for (let i = 0; i < 10; i++) {
    suma += parseInt(ruc[i]) * multiplicadores[i];
  }
  
  let digitoVerificador = 11 - (suma % 11);
  if (digitoVerificador === 10) digitoVerificador = 0;
  if (digitoVerificador === 11) digitoVerificador = 1;

  return digitoVerificador === parseInt(ruc[10]);
}

// Interfaz para la API de decolecta.com
async function fetchFromApisNetPe(type: "DNI" | "RUC", num: string) {
  const token = Deno.env.get("APIS_NET_PE_TOKEN"); // Seguimos usando la misma variable de entorno para la KEY de Decolecta
  if (!token) {
    throw new Error("Missing APIS_NET_PE_TOKEN environment variable");
  }

  const endpoint = type === "DNI" 
    ? `https://api.decolecta.com/api/dni/${num}`
    : `https://api.decolecta.com/api/ruc/${num}`;

  const res = await fetchWithPolicy(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    }
  }, { timeoutMs: 8_000, attempts: 2 });

  if (!res.ok) {
    if (res.status === 404) throw new Error("Documento no encontrado");
    if (res.status === 422) throw new Error("Parámetros inválidos");
    if (res.status === 401) throw new Error("Token API Inválido / Expirado (Verifica tu suscripción en Decolecta)");
    throw new Error(`API Error: HTTP ${res.status}`);
  }

  const raw = await res.json();
  
  if (!raw.success || !raw.data) {
    throw new Error(raw.error || "Error parseando respuesta de Decolecta");
  }

  const data = raw.data;
  
  // Normalizar data a un formato común
  if (type === "DNI") {
    return {
      nombreCompleto: data.nombre_completo || `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno}`.trim(),
      nombres: data.nombres,
      apellidoPaterno: data.apellido_paterno,
      apellidoMaterno: data.apellido_materno,
      numero: data.numero
    };
  } else {
    return {
      razonSocial: data.nombre_o_razon_social || data.razon_social,
      estado: data.estado,
      condicion: data.condicion,
      direccion: data.dirección_completa || data.direccion,
      ubigeo: data.ubigeo_sunat || data.ubigeo,
      numero: data.ruc || data.numero
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let type: "DNI" | "RUC" = "DNI";
  let document_number = "";
  const startTime = Date.now();
  const correlationId = requestId(req);
  let source = "CACHE";

  // Hallazgo #4: Validar JWT y resolver usuario/hotel desde BD
  const authResult = await authenticateRequest(req);
  if (authResult.error || !authResult.user) {
    return errorResponse(authResult.error || 'Unauthorized', authResult.status);
  }
  if (!['recepcionista', 'admin', 'developer'].includes(authResult.user.role)) {
    return errorResponse('Role not allowed to query identity data', 403);
  }

  const hotel_id = authResult.user.hotel_id;
  const usuario_id = authResult.user.id;

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    type = body.document_type;
    document_number = body.document_number;

    if (!hotel_id || !usuario_id) {
      throw new Error("Missing hotel_id or usuario_id for auditing");
    }

    if (type === "DNI") {
      DniSchema.parse(document_number);
    } else if (type === "RUC") {
      RucSchema.parse(document_number);
      if (!validarRUC(document_number)) {
        throw new Error("RUC Inválido (Fallo en dígito verificador)");
      }
    } else {
      throw new Error("document_type debe ser DNI o RUC");
    }

    // 1. Revisar Caché (TTL: DNI 30 días, RUC 1 día)
    const { data: cacheHit, error: cacheErr } = await supabase
      .from("identity_cache")
      .select("*")
      .eq("document_type", type)
      .eq("document_number", document_number)
      .single();

    if (cacheErr && cacheErr.code !== "PGRST116") {
      logEvent('warn', 'identity_cache_read_failed', { request_id: correlationId, code: cacheErr.code });
    }

    let resultData = null;

    if (cacheHit) {
      const lastUpdate = new Date(cacheHit.last_update);
      const now = new Date();
      const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      const isExpired = (type === "DNI" && diffDays > 30) || (type === "RUC" && diffDays > 1);

      if (!isExpired) {
        resultData = cacheHit.data;
      }
    }

    // 2. Si no hay cache o está expirado, consultar API
    if (!resultData) {
      source = "API";
      resultData = await fetchFromApisNetPe(type, document_number);

      // Guardar en Caché (Upsert)
      await supabase.from("identity_cache").upsert({
        document_type: type,
        document_number: document_number,
        data: resultData,
        last_update: new Date().toISOString()
      }, { onConflict: 'document_number' });
    }

    const responseTime = Date.now() - startTime;

    // Log para observabilidad
    await supabase.from("identity_logs").insert({
      hotel_id,
      usuario_id,
      document_type: type,
      document_number,
      response_time_ms: responseTime,
      source,
      success: true
    });

    return new Response(JSON.stringify({ success: true, data: resultData, source, request_id: correlationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": correlationId },
      status: 200,
    });

  // deno-lint-ignore no-explicit-any
  } catch (err: any) {
    logEvent('warn', 'identity_request_failed', {
      request_id: correlationId,
      document_type: type,
      error: err instanceof Error ? err.message.slice(0, 160) : 'unknown_error',
    });
    const responseTime = Date.now() - startTime;
    
    if (hotel_id && usuario_id && document_number) {
      await supabase.from("identity_logs").insert({
        hotel_id,
        usuario_id,
        document_type: type,
        document_number,
        response_time_ms: responseTime,
        source: "API",
        success: false,
        error_msg: err.message
      });
    }

    const status = err?.name === 'AbortError' ? 504
      : /no encontrado/i.test(err?.message || '') ? 404
      : /inv[aÃ¡]lido|debe tener|document_type/i.test(err?.message || '') ? 400
      : 502;
    return new Response(JSON.stringify({ success: false, error: err.message, request_id: correlationId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": correlationId },
      status,
    });
  }
});
