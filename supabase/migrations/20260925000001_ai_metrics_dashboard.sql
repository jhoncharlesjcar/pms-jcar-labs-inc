-- Migración: AI Metrics Dashboard (Semana 9)
-- Fecha: 2026-09-25
-- Feature: Métricas agregadas por hora/hotel, eventos detallados, dashboard en /dev

-- ============================================================================
-- Métricas agregadas por hora/hotel
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_metrics_hourly (
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
  total_tokens_input integer DEFAULT 0,
  total_tokens_output integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, hora, proveedor)
);

CREATE INDEX IF NOT EXISTS idx_ai_metrics_hotel_hora ON public.ai_metrics_hourly(hotel_id, hora DESC);
CREATE INDEX IF NOT EXISTS idx_ai_metrics_proveedor_hora ON public.ai_metrics_hourly(proveedor, hora DESC);

-- ============================================================================
-- Eventos detallados (retención 30 días)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  conversation_id uuid NOT NULL,
  proveedor text NOT NULL,
  evento text NOT NULL, -- 'request_start', 'tool_call', 'grounding_check', 'handoff', 'error', 'response_complete'
  latencia_ms integer,
  exito boolean,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_events_hotel_conv ON public.ai_events(hotel_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_events_proveedor_fecha ON public.ai_events(proveedor, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_events_evento ON public.ai_events(evento);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.ai_metrics_hourly ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_metrics_dev ON public.ai_metrics_hourly;
CREATE POLICY ai_metrics_dev ON public.ai_metrics_hourly
  FOR SELECT TO authenticated
  USING (get_user_role() = 'developer');

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_events_dev ON public.ai_events;
CREATE POLICY ai_events_dev ON public.ai_events
  FOR SELECT TO authenticated
  USING (get_user_role() = 'developer');

-- ============================================================================
-- RPC: Registrar métricas (invocado por ai-gateway)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_record_metric(
  p_hotel_id uuid,
  p_proveedor text,
  p_evento text,
  p_latencia_ms integer DEFAULT NULL,
  p_exito boolean DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_conversation_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hora timestamptz := date_trunc('hour', now());
BEGIN
  -- Insertar evento detallado
  INSERT INTO public.ai_events (
    hotel_id, conversation_id, proveedor, evento, latencia_ms, exito, metadata
  ) VALUES (
    p_hotel_id, p_conversation_id, p_proveedor, p_evento, p_latencia_ms, p_exito, p_metadata
  );

  -- Actualizar métricas horarias (upsert)
  CASE p_evento
    WHEN 'request_start' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, total_requests)
      VALUES (p_hotel_id, v_hora, p_proveedor, 1)
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        total_requests = ai_metrics_hourly.total_requests + 1;

    WHEN 'response_complete' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, successful_requests, total_tokens_input, total_tokens_output)
      VALUES (p_hotel_id, v_hora, p_proveedor, 
        CASE WHEN p_exito THEN 1 ELSE 0 END,
        COALESCE((p_metadata->>'tokens_input')::integer, 0),
        COALESCE((p_metadata->>'tokens_output')::integer, 0)
      )
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        successful_requests = ai_metrics_hourly.successful_requests + CASE WHEN p_exito THEN 1 ELSE 0 END,
        total_tokens_input = ai_metrics_hourly.total_tokens_input + COALESCE((p_metadata->>'tokens_input')::integer, 0),
        total_tokens_output = ai_metrics_hourly.total_tokens_output + COALESCE((p_metadata->>'tokens_output')::integer, 0),
        -- Recalcular avg_latency_ms usando latencia del evento anterior
        avg_latency_ms = CASE 
          WHEN ai_metrics_hourly.successful_requests > 0 THEN
            (ai_metrics_hourly.avg_latency_ms * ai_metrics_hourly.successful_requests + COALESCE(p_latencia_ms, 0)) / (ai_metrics_hourly.successful_requests + 1)
          ELSE COALESCE(p_latencia_ms, 0)
        END;

    WHEN 'fallback' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, fallback_count)
      VALUES (p_hotel_id, v_hora, p_proveedor, 1)
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        fallback_count = ai_metrics_hourly.fallback_count + 1;

    WHEN 'tool_call' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, tool_calls_total, tool_calls_success, tool_calls_failed)
      VALUES (p_hotel_id, v_hora, p_proveedor, 1,
        CASE WHEN p_exito THEN 1 ELSE 0 END,
        CASE WHEN p_exito THEN 0 ELSE 1 END
      )
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        tool_calls_total = ai_metrics_hourly.tool_calls_total + 1,
        tool_calls_success = ai_metrics_hourly.tool_calls_success + CASE WHEN p_exito THEN 1 ELSE 0 END,
        tool_calls_failed = ai_metrics_hourly.tool_calls_failed + CASE WHEN p_exito THEN 0 ELSE 1 END;

    WHEN 'grounding_failure' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, grounding_failures)
      VALUES (p_hotel_id, v_hora, p_proveedor, 1)
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        grounding_failures = ai_metrics_hourly.grounding_failures + 1;

    WHEN 'handoff' THEN
      INSERT INTO public.ai_metrics_hourly (hotel_id, hora, proveedor, handoff_count)
      VALUES (p_hotel_id, v_hora, p_proveedor, 1)
      ON CONFLICT (hotel_id, hora, proveedor) DO UPDATE SET
        handoff_count = ai_metrics_hourly.handoff_count + 1;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_record_metric TO authenticated;

-- ============================================================================
-- RPC: Obtener métricas agregadas para dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_get_metrics(
  p_hotel_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT (now() - INTERVAL '24 hours'),
  p_hasta timestamptz DEFAULT now(),
  p_proveedor text DEFAULT NULL
) RETURNS SETOF public.ai_metrics_hourly LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT *
  FROM public.ai_metrics_hourly
  WHERE (p_hotel_id IS NULL OR hotel_id = p_hotel_id)
    AND (p_proveedor IS NULL OR proveedor = p_proveedor)
    AND hora BETWEEN p_desde AND p_hasta
    AND get_user_role() = 'developer'
  ORDER BY hora DESC
$$;

GRANT EXECUTE ON FUNCTION public.ai_get_metrics TO authenticated;

-- ============================================================================
-- RPC: Obtener eventos de conversación
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_get_conversation_events(
  p_conversation_id uuid
) RETURNS SETOF public.ai_events LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT *
  FROM public.ai_events
  WHERE conversation_id = p_conversation_id
    AND get_user_role() = 'developer'
  ORDER BY created_at
$$;

GRANT EXECUTE ON FUNCTION public.ai_get_conversation_events TO authenticated;

-- ============================================================================
-- RPC: Resumen de métricas (para KPIs del dashboard)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_get_metrics_summary(
  p_hotel_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT (now() - INTERVAL '24 hours'),
  p_hasta timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'total_requests', COALESCE(SUM(total_requests), 0),
    'successful_requests', COALESCE(SUM(successful_requests), 0),
    'fallback_count', COALESCE(SUM(fallback_count), 0),
    'fallback_rate', CASE 
      WHEN SUM(total_requests) > 0 THEN 
        ROUND(SUM(fallback_count)::numeric / SUM(total_requests) * 100, 2)
      ELSE 0 
    END,
    'tool_calls_total', COALESCE(SUM(tool_calls_total), 0),
    'tool_calls_success', COALESCE(SUM(tool_calls_success), 0),
    'tool_calls_failed', COALESCE(SUM(tool_calls_failed), 0),
    'tool_success_rate', CASE 
      WHEN SUM(tool_calls_total) > 0 THEN 
        ROUND(SUM(tool_calls_success)::numeric / SUM(tool_calls_total) * 100, 2)
      ELSE 0 
    END,
    'handoff_count', COALESCE(SUM(handoff_count), 0),
    'handoff_rate', CASE 
      WHEN SUM(total_requests) > 0 THEN 
        ROUND(SUM(handoff_count)::numeric / SUM(total_requests) * 100, 2)
      ELSE 0 
    END,
    'grounding_failures', COALESCE(SUM(grounding_failures), 0),
    'avg_latency_ms', ROUND(AVG(avg_latency_ms)::numeric, 0),
    'total_tokens_input', COALESCE(SUM(total_tokens_input), 0),
    'total_tokens_output', COALESCE(SUM(total_tokens_output), 0),
    'by_provider', (
      SELECT jsonb_agg(jsonb_build_object(
        'proveedor', proveedor,
        'requests', SUM(total_requests),
        'success', SUM(successful_requests),
        'fallbacks', SUM(fallback_count),
        'avg_latency', ROUND(AVG(avg_latency_ms)::numeric, 0)
      ))
      FROM public.ai_metrics_hourly
      WHERE (p_hotel_id IS NULL OR hotel_id = p_hotel_id)
        AND hora BETWEEN p_desde AND p_hasta
      GROUP BY proveedor
    )
  )
  FROM public.ai_metrics_hourly
  WHERE (p_hotel_id IS NULL OR hotel_id = p_hotel_id)
    AND hora BETWEEN p_desde AND p_hasta
    AND get_user_role() = 'developer'
$$;

GRANT EXECUTE ON FUNCTION public.ai_get_metrics_summary TO authenticated;

-- ============================================================================
-- Cron job para limpiar eventos antiguos (retención 30 días)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.clean_ai_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.ai_events
  WHERE created_at < now() - INTERVAL '30 days';
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  -- También limpiar métricas horarias > 90 días
  DELETE FROM public.ai_metrics_hourly
  WHERE hora < now() - INTERVAL '90 days';
  
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_ai_events TO authenticated;

COMMENT ON MIGRATION IS 'AI Metrics Dashboard: hourly metrics, detailed events, recording RPC, dashboard queries, 30-day retention';