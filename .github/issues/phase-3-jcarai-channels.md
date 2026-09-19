# Phase 3: JcarAI & Canales (Semanas 8-9)

## Objetivo
Asistente más autónomo, medible y con anti-alucinación

## Issues a crear

### 3.1 Tool `get_past_guest_preferences(guest_id)`
**Labels:** `feature`, `ai`, `jcarai`, `phase-3`, `p1`
**Priority:** P0

**Description:**
Nueva tool para que JcarAI consulte preferencias históricas del huésped y sugiera upsells relevantes.

**Entregables:**

**Migración:** `20260924000001_ai_guest_insights.sql`
```sql
-- Vista materializada de insights por huésped (refrescada diariamente)
CREATE MATERIALIZED VIEW public.v_ai_guest_insights AS
SELECT 
  la.hotel_id,
  la.tipo_documento,
  la.numero_documento,
  la.nombre as guest_name,
  -- Consumos habituales
  jsonb_agg(DISTINCT jsonb_build_object(
    'categoria', c.nombre,
    'producto', p.nombre,
    'veces', cnt
  )) FILTER (WHERE c.id IS NOT NULL) as consumos_habituales,
  -- Paquetes previos
  jsonb_agg(DISTINCT jsonb_build_object(
    'paquete', pa.nombre,
    'tipo', pa.tipo,
    'veces', pcnt
  )) FILTER (WHERE pa.id IS NOT NULL) as paquetes_previos,
  -- Estadísticas estancia
  COUNT(DISTINCT r.id) as total_estancias,
  AVG(r.noches)::numeric(4,1) as noches_promedio,
  MAX(r.fecha_entrada) as ultima_estancia,
  -- Valor
  COALESCE(SUM(r.total), 0) as valor_total_historico
FROM public.loyalty_accounts la
LEFT JOIN public.reservas r ON r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
LEFT JOIN public.ventas_pos vp ON vp.huesped_dni = la.numero_documento AND vp.hotel_id = la.hotel_id
LEFT JOIN public.productos p ON p.id = vp.producto_id
LEFT JOIN public.categorias_productos c ON c.id = p.categoria_id
LEFT JOIN public.reserva_paquetes rp ON rp.reserva_id = r.id
LEFT JOIN public.paquetes pa ON pa.id = rp.paquete_id
GROUP BY la.hotel_id, la.tipo_documento, la.numero_documento, la.nombre
WITH DATA;

CREATE UNIQUE INDEX idx_v_ai_guest_insights_pk ON public.v_ai_guest_insights(hotel_id, tipo_documento, numero_documento);

-- Función para refrescar (cron diario 03:00)
CREATE OR REPLACE FUNCTION public.refresh_ai_guest_insights()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_ai_guest_insights;
$$;

-- RPC para JcarAI tool
CREATE OR REPLACE FUNCTION public.ai_get_guest_insights(
  p_hotel_id uuid,
  p_tipo_documento text,
  p_numero_documento text
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT to_jsonb(t) FROM public.v_ai_guest_insights t
  WHERE t.hotel_id = p_hotel_id
    AND t.tipo_documento = p_tipo_documento
    AND t.numero_documento = p_numero_documento
$$;

GRANT EXECUTE ON FUNCTION public.ai_get_guest_insights TO authenticated;
```

**JcarAI Gateway:** `supabase/functions/ai-gateway/tools/guest-insights.ts`
```typescript
export const get_past_guest_preferences = {
  name: 'get_past_guest_preferences',
  description: 'Obtiene preferencias históricas de un huésped para personalizar ofertas',
  parameters: {
    type: 'object',
    properties: {
      tipo_documento: { type: 'string', enum: ['DNI','CE','PAS'] },
      numero_documento: { type: 'string' }
    },
    required: ['tipo_documento', 'numero_documento']
  },
  handler: async (args, { hotelId, supabase }) => {
    const { data, error } = await supabase.rpc('ai_get_guest_insights', {
      p_hotel_id: hotelId,
      p_tipo_documento: args.tipo_documento,
      p_numero_documento: args.numero_documento
    })
    if (error) throw new Error(error.message)
    return data || { consumos_habituales: [], paquetes_previos: [], total_estancias: 0 }
  }
}
```

**Registro en tool loop:** Añadir a `availableTools` en `ai-gateway/index.ts`

**Tests:** Unit (RPC devuelve JSON correcto), Integración (JcarAI usa tool en conversación)

**Acceptance Criteria:**
- [ ] RPC devuelve insights completos en <200ms
- [ ] JcarAI invoca tool automáticamente al detectar huésped recurrente
- [ ] Sugerencias de upsell basadas en historial (≥60% relevancia en tests sintéticos)
- [ ] Vista materializada se refresca diariamente via cron

---

### 3.2 Tool `suggest_upsells(reserva_id)`
**Labels:** `feature`, `ai`, `jcarai`, `phase-3`, `p1`
**Priority:** P0

**Description:**
Tool que devuelve paquetes compatibles con la estancia actual para que JcarAI los ofrezca proactivamente.

**Entregables:**

**RPC:** (en migración 2.4 `paquetes_addons` o nueva)
```sql
CREATE OR REPLACE FUNCTION public.ai_suggest_upsells(
  p_reserva_id uuid
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_agg(jsonb_build_object(
    'paquete_id', p.id,
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'tipo', p.tipo,
    'precio_calculado', CASE 
      WHEN p.precio_tipo = 'fijo' THEN p.precio_valor
      WHEN p.precio_tipo = 'porcentaje_estadia' THEN (SELECT total FROM public.reservas WHERE id = p_reserva_id) * p.precio_valor / 100
      WHEN p.precio_tipo = 'por_noche' THEN p.precio_valor * (SELECT noches FROM public.reservas WHERE id = p_reserva_id)
      WHEN p.precio_tipo = 'por_persona' THEN p.precio_valor * (SELECT adultos + ninos FROM public.reservas WHERE id = p_reserva_id)
    END,
    'moneda', p.moneda,
    'imagen_url', p.imagen_url
  )) FROM public.paquetes p
  WHERE p.hotel_id = (SELECT hotel_id FROM public.reservas WHERE id = p_reserva_id)
    AND p.activo = true
    AND p.id NOT IN (SELECT paquete_id FROM public.reserva_paquetes WHERE reserva_id = p_reserva_id)
    AND (
      p.tipo != 'traslado' OR (SELECT fecha_entrada FROM public.reservas WHERE id = p_reserva_id) > CURRENT_DATE + INTERVAL '1 day'
    )
    AND (
      p.tipo != 'late_checkout' OR (SELECT fecha_salida FROM public.reservas WHERE id = p_reserva_id) > CURRENT_DATE
    )
$$;
```

**JcarAI Gateway:** `supabase/functions/ai-gateway/tools/suggest-upsells.ts`

**Tests:** Unit (filtra paquetes ya añadidos, respeta fechas), Integración

**Acceptance Criteria:**
- [ ] Solo devuelve paquetes no añadidos a la reserva
- [ ] Filtra por lógica de negocio (traslado >1 día, late checkout fecha salida futura)
- [ ] Precio calculado correctamente según tipo
- [ ] JcarAI ofrece upsell en momento adecuado (post-reserva, pre-checkin)

---

### 3.3 Grounding Check: Validación anti-alucinación
**Labels:** `feature`, `ai`, `safety`, `phase-3`, `p0`
**Priority:** P0

**Description:**
Middleware que valida toda respuesta del LLM contra hechos reales (disponibilidad, precios, políticas) antes de enviarla al usuario.

**Entregables:**

**Middleware:** `supabase/functions/ai-gateway/middleware/groundingCheck.ts`
```typescript
interface GroundingFact {
  type: 'availability' | 'price' | 'policy' | 'room_exists'
  query: unknown
  expected: unknown
  actual: unknown
  match: boolean
}

export async function groundingCheck(
  response: string,
  context: { hotelId: string; conversationId: string; toolsUsed: string[] },
  supabase: SupabaseClient
): Promise<{ safe: boolean; issues: GroundingFact[]; sanitizedResponse?: string }> {
  const issues: GroundingFact[] = []
  
  // 1. Extraer claims de precio/disponibilidad del response (regex simple o LLM judge)
  const priceClaims = extractPriceClaims(response)
  const availabilityClaims = extractAvailabilityClaims(response)
  
  // 2. Validar cada claim contra BD
  for (const claim of priceClaims) {
    const actual = await supabase.rpc('get_room_price_for_date', { ...claim.params })
    issues.push({
      type: 'price',
      query: claim.params,
      expected: claim.value,
      actual: actual.data,
      match: Math.abs(Number(actual.data) - Number(claim.value)) < 0.01
    })
  }
  
  for (const claim of availabilityClaims) {
    const actual = await supabase.rpc('check_availability', { ...claim.params })
    issues.push({
      type: 'availability',
      query: claim.params,
      expected: claim.value,
      actual: actual.data,
      match: actual.data === claim.value
    })
  }
  
  const failed = issues.filter(i => !i.match)
  
  if (failed.length > 0) {
    // Sanitizar: reemplazar claims falsos con "consulte disponibilidad actual"
    const sanitized = sanitizeResponse(response, failed)
    return { safe: false, issues: failed, sanitizedResponse: sanitized }
  }
  
  return { safe: true, issues: [] }
}

function extractPriceClaims(text: string) { ... }
function extractAvailabilityClaims(text: string) { ... }
function sanitizeResponse(text: string, failed: GroundingFact[]) { ... }
```

**Integración:** En `ai-gateway/index.ts` tool loop, antes de `return finalResponse`:
```typescript
const grounding = await groundingCheck(finalResponse, { hotelId, conversationId, toolsUsed }, supabase)
if (!grounding.safe) {
  logger.warn('Grounding check failed', { issues: grounding.issues })
  return grounding.sanitizedResponse || 'Permítame verificar la información actualizada...'
}
```

**Tests sintéticos:** 100 casos de alucinaciones conocidas (precios inventados, habitaciones inexistentes, políticas falsas) → 0 deben pasar.

**Acceptance Criteria:**
- [ ] 0 alucinaciones de precio/disponibilidad en 100 tests sintéticos
- [ ] Latencia añadida <500ms por respuesta
- [ ] Respuesta sanitizada mantiene tono conversacional
- [ ] Log de grounding failures para auditoría

---

### 3.4 Dashboard Telemetría AI
**Labels:** `feature`, `ai`, `observability`, `phase-3`, `p1`
**Priority:** P1

**Description:**
Dashboard en `/dev` (rol developer) con métricas de calidad del AI.

**Entregables:**

**Migración:** `20260925000001_ai_metrics_dashboard.sql`
```sql
-- Métricas agregadas por hora/hotel
CREATE TABLE public.ai_metrics_hourly (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  hora timestamptz NOT NULL,
  proveedor text NOT NULL, -- 'qwen' | 'gemini'
  total_requests integer DEFAULT 0,
  successful_requests integer DEFAULT 0,
  fallback_count integer DEFAULT 0,
  tool_calls_total integer DEFAULT 0,
  tool_calls_success integer DEFAULT 0,
  tool_calls_failed integer DEFAULT 0,
  handoff_count integer DEFAULT 0,
  avg_latency_ms integer DEFAULT 0,
  p95_latency_ms integer DEFAULT 0,
  grounding_failures integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, hora, proveedor)
);
CREATE INDEX idx_ai_metrics_hotel_hora ON public.ai_metrics_hourly(hotel_id, hora DESC);

-- Eventos detallados (retención 30 días)
CREATE TABLE public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  conversation_id uuid NOT NULL,
  proveedor text NOT NULL,
  evento text NOT NULL, -- 'request_start', 'tool_call', 'grounding_check', 'handoff', 'error'
  latencia_ms integer,
  exito boolean,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_ai_events_hotel_conv ON public.ai_events(hotel_id, conversation_id, created_at);
CREATE INDEX idx_ai_events_proveedor_fecha ON public.ai_events(proveedor, created_at);

-- RLS
ALTER TABLE public.ai_metrics_hourly ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_metrics_dev ON public.ai_metrics_hourly FOR SELECT TO authenticated USING (get_user_role() = 'developer');

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_events_dev ON public.ai_events FOR SELECT TO authenticated USING (get_user_role() = 'developer');
```

**Edge Function:** `ai-metrics-collector` (invocada por ai-gateway al final de cada request)

**Hook:** `src/pages/JcarAI/hooks/useAIMetrics.ts`
- `useAIMetrics(hotelId, rango)` → datos agregados
- `useAIEvents(conversationId)` → detalle conversación

**UI:** `src/pages/PanelDesarrollador/components/AIMetricsDashboard.jsx`
- Tabs: Resumen, Por Proveedor, Por Conversación, Grounding
- Gráficos: Requests/hora, Fallback rate, Latencia p50/p95, Tool success rate, Handoff rate, Grounding failures
- Filtros: hotel, proveedor, rango fechas
- Tabla últimas 50 conversaciones con status

**Tests:** Unit (agregaciones), E2E (dashboard carga y filtra)

**Acceptance Criteria:**
- [ ] Métricas se colectan automáticamente en cada request AI
- [ ] Dashboard muestra datos en tiempo real (refresh 30s)
- [ ] Fallback rate, latency, tool success, handoff rate visibles
- [ ] Grounding failures trazables a conversación
- [ ] Solo rol developer accede

---

## Métricas de éxito Fase 3
| Métrica | Target |
|---------|--------|
| Fallback rate (Qwen→Gemini o viceversa) | <10% |
| Alucinaciones precio/disponibilidad | 0 en 100 tests sintéticos |
| Upsell conversion rate (suggest_upsells) | ≥15% |
| Grounding check latency overhead | <500ms |
| Handoff a humano rate | <5% conversaciones |

## Riesgos
| Riesgo | Mitigación |
|--------|------------|
| Grounding check añade latencia | Cache de precios/disponibilidad 30s; async no-blocking para métricas |
| Tool loop infinito | Max 5 tool calls por turn; timeout 10s por tool |
| Costos LLM aumentan | Monitorear tokens/request; alerta si >promedio +2σ |