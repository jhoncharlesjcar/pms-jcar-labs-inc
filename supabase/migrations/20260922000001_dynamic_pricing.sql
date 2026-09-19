-- Migración: Motor de Tarifas Dinámicas Configurable (Semana 6)
-- Fecha: 2026-09-22
-- Feature: Reglas de precio: temporada × día-semana × ocupación → factor. UI admin CRUD + preview calendario. Cron nocturno recalcula.

-- ============================================================================
-- Temporadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifa_temporadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  fecha_inicio date NOT NULL,
  fecha_fin date NOT NULL,
  factor numeric(4,3) NOT NULL DEFAULT 1.000, -- ej 1.200 = +20%
  prioridad integer DEFAULT 0, -- mayor = prioridad
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarifa_temporadas_hotel_fechas ON public.tarifa_temporadas(hotel_id, fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_tarifa_temporadas_activa ON public.tarifa_temporadas(activa);

DROP TRIGGER IF EXISTS trigger_tarifa_temporadas_updated_at ON public.tarifa_temporadas;
CREATE TRIGGER trigger_tarifa_temporadas_updated_at
  BEFORE UPDATE ON public.tarifa_temporadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Reglas día-semana
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifa_reglas_dia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  dia_semana integer NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo
  factor numeric(4,3) NOT NULL DEFAULT 1.000,
  aplica_solo_si_temporada_id uuid REFERENCES public.tarifa_temporadas(id),
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, dia_semana, activa) WHERE activa
);

CREATE INDEX IF NOT EXISTS idx_tarifa_reglas_dia_hotel ON public.tarifa_reglas_dia(hotel_id, activa);

-- ============================================================================
-- Reglas ocupación
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifa_reglas_ocupacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  ocupacion_min_pct integer NOT NULL CHECK (ocupacion_min_pct BETWEEN 0 AND 100),
  ocupacion_max_pct integer NOT NULL CHECK (ocupacion_max_pct BETWEEN 0 AND 100),
  factor numeric(4,3) NOT NULL DEFAULT 1.000,
  activa boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tarifa_reglas_ocupacion_hotel ON public.tarifa_reglas_ocupacion(hotel_id, activa);

-- ============================================================================
-- Tarifas calculadas (cache nocturno)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tarifas_calculadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  fecha date NOT NULL,
  precio_base numeric(10,2) NOT NULL,
  factor_temporada numeric(4,3) DEFAULT 1.000,
  factor_dia numeric(4,3) DEFAULT 1.000,
  factor_ocupacion numeric(4,3) DEFAULT 1.000,
  precio_final numeric(10,2) NOT NULL,
  calculada_en timestamptz DEFAULT now(),
  UNIQUE (habitacion_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_tarifas_calc_hotel_fecha ON public.tarifas_calculadas(hotel_id, fecha);
CREATE INDEX IF NOT EXISTS idx_tarifas_calc_habitacion_fecha ON public.tarifas_calculadas(habitacion_id, fecha);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.tarifa_temporadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tt_all ON public.tarifa_temporadas;
CREATE POLICY tt_all ON public.tarifa_temporadas
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.tarifa_reglas_dia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trd_all ON public.tarifa_reglas_dia;
CREATE POLICY trd_all ON public.tarifa_reglas_dia
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.tarifa_reglas_ocupacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tro_all ON public.tarifa_reglas_ocupacion;
CREATE POLICY tro_all ON public.tarifa_reglas_ocupacion
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.tarifas_calculadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tc_select ON public.tarifas_calculadas;
CREATE POLICY tc_select ON public.tarifas_calculadas
  FOR SELECT TO anon, authenticated
  USING (hotel_id = get_user_hotel_id());

DROP POLICY IF EXISTS tc_admin ON public.tarifas_calculadas;
CREATE POLICY tc_admin ON public.tarifas_calculadas
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'))
  WITH CHECK (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'));

-- ============================================================================
-- RPC: Calcular factor temporada para fecha
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tarifa_factor_temporada(
  p_hotel_id uuid,
  p_fecha date
) RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT COALESCE(MAX(factor), 1.000)
  FROM public.tarifa_temporadas
  WHERE hotel_id = p_hotel_id
    AND activa = true
    AND fecha_inicio <= p_fecha
    AND fecha_fin >= p_fecha
$$;

GRANT EXECUTE ON FUNCTION public.get_tarifa_factor_temporada TO authenticated;

-- ============================================================================
-- RPC: Calcular factor día semana
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tarifa_factor_dia(
  p_hotel_id uuid,
  p_fecha date,
  p_temporada_id uuid DEFAULT NULL
) RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT COALESCE(factor, 1.000)
  FROM public.tarifa_reglas_dia
  WHERE hotel_id = p_hotel_id
    AND activa = true
    AND dia_semana = EXTRACT(DOW FROM p_fecha)::integer
    AND (aplica_solo_si_temporada_id IS NULL OR aplica_solo_si_temporada_id = p_temporada_id)
  ORDER BY aplica_solo_si_temporada_id DESC NULLS LAST
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_tarifa_factor_dia TO authenticated;

-- ============================================================================
-- RPC: Calcular factor ocupación
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tarifa_factor_ocupacion(
  p_hotel_id uuid,
  p_fecha date
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_ocupacion_pct numeric;
  v_total_hab integer;
  v_ocupadas integer;
BEGIN
  -- Contar habitaciones totales activas
  SELECT COUNT(*) INTO v_total_hab
  FROM public.habitaciones
  WHERE hotel_id = p_hotel_id AND activo = true;

  IF v_total_hab = 0 THEN
    RETURN 1.000;
  END IF;

  -- Contar ocupadas (reservas activas + confirmadas + holds no vencidos)
  SELECT COUNT(DISTINCT r.habitacion_id) INTO v_ocupadas
  FROM public.reservas r
  WHERE r.hotel_id = p_hotel_id
    AND r.estado IN ('activa', 'confirmada')
    AND r.fecha_entrada <= p_fecha
    AND r.fecha_salida > p_fecha;

  -- También considerar holds de AI
  SELECT COUNT(DISTINCT h.room_id) INTO v_ocupadas
  FROM public.ai_reservation_holds h
  JOIN public.ai_booking_intents i ON i.id = h.booking_intent_id
  WHERE i.hotel_id = p_hotel_id
    AND h.room_id IS NOT NULL
    AND h.expires_at > now()
    AND i.status IN ('HOLD_ACTIVE', 'PAYMENT_PENDING')
  UNION ALL
  SELECT v_ocupadas;

  v_ocupacion_pct := (v_ocupadas::numeric / v_total_hab) * 100;

  -- Buscar regla que coincida
  RETURN COALESCE((
    SELECT factor
    FROM public.tarifa_reglas_ocupacion
    WHERE hotel_id = p_hotel_id
      AND activa = true
      AND ocupacion_min_pct <= v_ocupacion_pct
      AND ocupacion_max_pct >= v_ocupacion_pct
    ORDER BY ocupacion_min_pct DESC
    LIMIT 1
  ), 1.000);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tarifa_factor_ocupacion TO authenticated;

-- ============================================================================
-- RPC: Recalcular tarifas para hotel (cron nocturno)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_hotel_rates(
  p_hotel_id uuid,
  p_dias_adelante integer DEFAULT 90
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hab RECORD;
  v_fecha date;
  v_precio_base numeric(10,2);
  v_factor_temp numeric;
  v_factor_dia numeric;
  v_factor_occ numeric;
  v_precio_final numeric;
  v_processed integer := 0;
  v_errors integer := 0;
  v_temporada_id uuid;
BEGIN
  -- Validar permisos
  IF p_hotel_id != get_user_hotel_id() AND get_user_role() != 'developer' THEN
    RAISE EXCEPTION 'Sin permisos para recalcular tarifas de este hotel';
  END IF;

  FOR v_hab IN
    SELECT id, precio_noche FROM public.habitaciones
    WHERE hotel_id = p_hotel_id AND activo = true
  LOOP
    v_precio_base := v_hab.precio_noche;

    FOR v_fecha IN
      SELECT generate_series(CURRENT_DATE, CURRENT_DATE + p_dias_adelante, INTERVAL '1 day')::date
    LOOP
      BEGIN
        -- Obtener factor temporada
        SELECT id INTO v_temporada_id
        FROM public.tarifa_temporadas
        WHERE hotel_id = p_hotel_id
          AND activa = true
          AND fecha_inicio <= v_fecha
          AND fecha_fin >= v_fecha
        ORDER BY prioridad DESC, factor DESC
        LIMIT 1;

        v_factor_temp := COALESCE((
          SELECT factor FROM public.tarifa_temporadas WHERE id = v_temporada_id
        ), 1.000);

        v_factor_dia := public.get_tarifa_factor_dia(p_hotel_id, v_fecha, v_temporada_id);
        v_factor_occ := public.get_tarifa_factor_ocupacion(p_hotel_id, v_fecha);

        v_precio_final := v_precio_base * v_factor_temp * v_factor_dia * v_factor_occ;

        INSERT INTO public.tarifas_calculadas (
          hotel_id, habitacion_id, fecha,
          precio_base, factor_temporada, factor_dia, factor_ocupacion, precio_final
        ) VALUES (
          p_hotel_id, v_hab.id, v_fecha,
          v_precio_base, v_factor_temp, v_factor_dia, v_factor_occ, v_precio_final
        )
        ON CONFLICT (habitacion_id, fecha) DO UPDATE SET
          precio_base = EXCLUDED.precio_base,
          factor_temporada = EXCLUDED.factor_temporada,
          factor_dia = EXCLUDED.factor_dia,
          factor_ocupacion = EXCLUDED.factor_ocupacion,
          precio_final = EXCLUDED.precio_final,
          calculada_en = now();

        v_processed := v_processed + 1;
      EXCEPTION WHEN OTHERS THEN
        v_errors := v_errors + 1;
      END;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'hotel_id', p_hotel_id,
    'processed', v_processed,
    'errors', v_errors,
    'fecha_desde', CURRENT_DATE,
    'fecha_hasta', CURRENT_DATE + p_dias_adelante
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_hotel_rates TO authenticated;

-- ============================================================================
-- RPC: Preview tarifas (para UI)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.preview_tarifas_dinamicas(
  p_hotel_id uuid,
  p_fecha_inicio date,
  p_fecha_fin date
) RETURNS SETOF public.tarifas_calculadas LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT tc.*
  FROM public.tarifas_calculadas tc
  WHERE tc.hotel_id = p_hotel_id
    AND tc.fecha BETWEEN p_fecha_inicio AND p_fecha_fin
  ORDER BY tc.fecha, tc.habitacion_id
$$;

GRANT EXECUTE ON FUNCTION public.preview_tarifas_dinamicas TO authenticated;

-- ============================================================================
-- Función para obtener precio dinámico (usado por search_availability)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dynamic_room_price(
  p_habitacion_id uuid,
  p_fecha date
) RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT COALESCE(precio_final, precio_base)
  FROM public.tarifas_calculadas
  WHERE habitacion_id = p_habitacion_id
    AND fecha = p_fecha
$$;

GRANT EXECUTE ON FUNCTION public.get_dynamic_room_price TO authenticated, anon;

COMMENT ON MIGRATION IS 'Tarifas Dinámicas: temporadas, reglas día/ocupación, cache nocturno, preview, RPC para JcarAI';