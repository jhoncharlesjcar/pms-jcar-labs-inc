-- Migración: JcarAI Guest Insights & Upsells (Semana 8)
-- Fecha: 2026-09-24
-- Feature: Tools get_past_guest_preferences, suggest_upsells, grounding check support

-- ============================================================================
-- Vista materializada de insights por huésped (refrescada diariamente)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.v_ai_guest_insights AS
SELECT 
  la.hotel_id,
  la.tipo_documento,
  la.numero_documento,
  la.nombre as guest_name,
  -- Consumos habituales (top 10)
  (
    SELECT jsonb_agg(jsonb_build_object(
      'categoria', c.nombre,
      'producto', p.nombre,
      'veces', cnt
    ) ORDER BY cnt DESC)
    FROM (
      SELECT p.categoria_id, p.nombre, COUNT(*) as cnt
      FROM public.ventas_pos vp
      JOIN public.productos p ON p.id = vp.producto_id
      WHERE vp.huesped_dni = la.numero_documento
        AND vp.hotel_id = la.hotel_id
      GROUP BY p.categoria_id, p.nombre
      ORDER BY cnt DESC
      LIMIT 10
    ) p
    LEFT JOIN public.categorias_productos c ON c.id = p.categoria_id
  ) as consumos_habituales,
  -- Paquetes previos
  (
    SELECT jsonb_agg(jsonb_build_object(
      'paquete', pa.nombre,
      'tipo', pa.tipo,
      'veces', pcnt
    ) ORDER BY pcnt DESC)
    FROM (
      SELECT rp.paquete_id, COUNT(*) as pcnt
      FROM public.reserva_paquetes rp
      JOIN public.reservas r ON r.id = rp.reserva_id
      WHERE r.huesped_dni = la.numero_documento
        AND r.hotel_id = la.hotel_id
      GROUP BY rp.paquete_id
    ) rp
    JOIN public.paquetes pa ON pa.id = rp.paquete_id
  ) as paquetes_previos,
  -- Estadísticas estancia
  COUNT(DISTINCT r.id) as total_estancias,
  AVG(r.noches)::numeric(4,1) as noches_promedio,
  MAX(r.fecha_entrada) as ultima_estancia,
  -- Valor
  COALESCE(SUM(r.total), 0) as valor_total_historico,
  -- Última habitación
  (
    SELECT jsonb_build_object(
      'numero', h.numero,
      'tipo', h.tipo
    )
    FROM public.reservas r2
    JOIN public.habitaciones h ON h.id = r2.habitacion_id
    WHERE r2.huesped_dni = la.numero_documento
      AND r2.hotel_id = la.hotel_id
    ORDER BY r2.fecha_entrada DESC
    LIMIT 1
  ) as ultima_habitacion
FROM public.loyalty_accounts la
LEFT JOIN public.reservas r ON r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
GROUP BY la.hotel_id, la.tipo_documento, la.numero_documento, la.nombre
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v_ai_guest_insights_pk ON public.v_ai_guest_insights(hotel_id, tipo_documento, numero_documento);

-- ============================================================================
-- Función para refrescar (cron diario 03:00)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.refresh_ai_guest_insights()
RETURNS void LANGUAGE sql AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.v_ai_guest_insights;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_ai_guest_insights TO authenticated;

-- ============================================================================
-- RPC para JcarAI tool: get_past_guest_preferences
-- ============================================================================

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

-- ============================================================================
-- RPC para JcarAI tool: suggest_upsells (extendido con guest insights)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_suggest_upsells_v2(
  p_reserva_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_result jsonb;
  v_reserva RECORD;
  v_guest_insights jsonb;
BEGIN
  -- Obtener reserva
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  -- Obtener insights del huésped si tiene DNI
  IF v_reserva.huesped_dni IS NOT NULL THEN
    SELECT * INTO v_guest_insights
    FROM public.v_ai_guest_insights
    WHERE hotel_id = v_reserva.hotel_id
      AND tipo_documento = COALESCE(v_reserva.tipo_documento, 'DNI')
      AND numero_documento = v_reserva.huesped_dni;
  END IF;

  -- Construir resultado con paquetes + insights
  SELECT jsonb_agg(jsonb_build_object(
    'paquete_id', p.id,
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'tipo', p.tipo,
    'precio_calculado', CASE 
      WHEN p.precio_tipo = 'fijo' THEN p.precio_valor
      WHEN p.precio_tipo = 'porcentaje_estadia' THEN v_reserva.total * p.precio_valor / 100
      WHEN p.precio_tipo = 'por_noche' THEN p.precio_valor * v_reserva.noches
      WHEN p.precio_tipo = 'por_persona' THEN p.precio_valor * (v_reserva.num_adultos + v_reserva.num_ninos)
    END,
    'moneda', p.moneda,
    'imagen_url', p.imagen_url,
    'relevance_score', CASE
      WHEN v_guest_insights IS NOT NULL AND v_guest_insights->'paquetes_previos' IS NOT NULL THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_guest_insights->'paquetes_previos') pp
          WHERE pp->>'paquete' = p.nombre
        ) THEN 0.9 ELSE 0.5 END
      ELSE 0.3
    END
  )) INTO v_result
  FROM public.paquetes p
  WHERE p.hotel_id = v_reserva.hotel_id
    AND p.activo = true
    AND p.id NOT IN (SELECT paquete_id FROM public.reserva_paquetes WHERE reserva_id = p_reserva_id)
    AND (
      p.tipo != 'traslado' OR v_reserva.fecha_entrada > CURRENT_DATE + INTERVAL '1 day'
    )
    AND (
      p.tipo != 'late_checkout' OR v_reserva.fecha_salida > CURRENT_DATE
    );

  RETURN jsonb_build_object(
    'upsells', COALESCE(v_result, '[]'::jsonb),
    'guest_insights', v_guest_insights
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_suggest_upsells_v2 TO authenticated;

-- ============================================================================
-- Tabla de precios cacheados para grounding check
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_price_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  fecha date NOT NULL,
  precio_final numeric(10,2) NOT NULL,
  disponible boolean DEFAULT true,
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + INTERVAL '30 minutes'),
  UNIQUE (habitacion_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_ai_price_cache_hotel_fecha ON public.ai_price_cache(hotel_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ai_price_cache_expires ON public.ai_price_cache(expires_at);

-- RLS
ALTER TABLE public.ai_price_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_price_cache_select ON public.ai_price_cache;
CREATE POLICY ai_price_cache_select ON public.ai_price_cache
  FOR SELECT TO authenticated, anon
  USING (hotel_id = get_user_hotel_id() AND expires_at > now());

DROP POLICY IF EXISTS ai_price_cache_admin ON public.ai_price_cache;
CREATE POLICY ai_price_cache_admin ON public.ai_price_cache
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'))
  WITH CHECK (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'));

-- ============================================================================
-- RPC: Poblar cache de precios (invocado por ai-gateway antes de responder)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.populate_ai_price_cache(
  p_hotel_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_count integer := 0;
  v_hab RECORD;
  v_fecha date;
  v_precio numeric;
BEGIN
  FOR v_hab IN
    SELECT id FROM public.habitaciones WHERE hotel_id = p_hotel_id AND activo = true
  LOOP
    FOR v_fecha IN
      SELECT generate_series(p_fecha_inicio, p_fecha_fin, INTERVAL '1 day')::date
    LOOP
      -- Usar tarifas dinámicas si existen, sino precio base
      SELECT COALESCE(tc.precio_final, h.precio_noche) INTO v_precio
      FROM public.habitaciones h
      LEFT JOIN public.tarifas_calculadas tc ON tc.habitacion_id = h.id AND tc.fecha = v_fecha
      WHERE h.id = v_hab.id;

      INSERT INTO public.ai_price_cache (hotel_id, habitacion_id, fecha, precio_final, disponible, expires_at)
      VALUES (p_hotel_id, v_hab.id, v_fecha, v_precio, true, now() + INTERVAL '30 minutes')
      ON CONFLICT (habitacion_id, fecha) DO UPDATE SET
        precio_final = EXCLUDED.precio_final,
        disponible = EXCLUDED.disponible,
        cached_at = now(),
        expires_at = EXCLUDED.expires_at;

      v_count := v_count + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.populate_ai_price_cache TO authenticated;

-- ============================================================================
-- RPC: Verificar precio para grounding check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_verify_price(
  p_hotel_id uuid,
  p_habitacion_id uuid,
  p_fecha date,
  p_precio_claimado numeric
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'match', CASE 
      WHEN pc.precio_final IS NOT NULL THEN 
        ABS(pc.precio_final - p_precio_claimado) < 0.01
      ELSE false
    END,
    'precio_real', pc.precio_final,
    'precio_claimado', p_precio_claimado,
    'disponible', COALESCE(pc.disponible, false),
    'cached_at', pc.cached_at
  )
  FROM public.ai_price_cache pc
  WHERE pc.hotel_id = p_hotel_id
    AND pc.habitacion_id = p_habitacion_id
    AND pc.fecha = p_fecha
    AND pc.expires_at > now()
$$;

GRANT EXECUTE ON FUNCTION public.ai_verify_price TO authenticated;

-- ============================================================================
-- RPC: Verificar disponibilidad para grounding check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_verify_availability(
  p_hotel_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_adultos integer,
  p_ninos integer,
  p_habitacion_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'disponible', COUNT(*) > 0,
    'habitaciones', jsonb_agg(jsonb_build_object(
      'id', h.id,
      'numero', h.numero,
      'tipo', h.tipo,
      'precio', COALESCE(tc.precio_final, h.precio_noche)
    ))
  )
  FROM public.habitaciones h
  LEFT JOIN public.tarifas_calculadas tc ON tc.habitacion_id = h.id AND tc.fecha = p_fecha_entrada
  WHERE h.hotel_id = p_hotel_id
    AND h.activo = true
    AND (p_habitacion_id IS NULL OR h.id = p_habitacion_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.habitacion_id = h.id
        AND r.estado IN ('activa', 'confirmada')
        AND r.fecha_entrada < p_fecha_salida
        AND r.fecha_salida > p_fecha_entrada
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.ai_reservation_holds h2
      JOIN public.ai_booking_intents i ON i.id = h2.booking_intent_id
      WHERE h2.room_id = h.id
        AND h2.expires_at > now()
        AND i.status IN ('HOLD_ACTIVE', 'PAYMENT_PENDING')
    )
$$;

GRANT EXECUTE ON FUNCTION public.ai_verify_availability TO authenticated;

COMMENT ON MIGRATION IS 'JcarAI Phase 3: guest insights materialized view, upsells v2, price cache for grounding check, verify price/availability RPCs';