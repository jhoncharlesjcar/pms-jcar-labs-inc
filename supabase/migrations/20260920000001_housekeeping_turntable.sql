-- Migración: Housekeeping Turntable (Semana 4)
-- Fecha: 2026-09-20
-- Feature: Sistema completo de gestión de limpieza con checklist, incidencias con foto y scoring

-- ============================================================================
-- Tareas de limpieza por habitación/fecha
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.housekeeping_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  fecha_operativa date NOT NULL,
  asignado_a uuid REFERENCES auth.users(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','completada','omitida')),
  checklist jsonb NOT NULL DEFAULT '[]', -- [{item, completado, notas}]
  puntuacion integer, -- 0-100
  iniciada_en timestamptz,
  completada_en timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (habitacion_id, fecha_operativa)
);

CREATE INDEX IF NOT EXISTS idx_hk_tasks_hotel_fecha ON public.housekeeping_tasks(hotel_id, fecha_operativa);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_asignado ON public.housekeeping_tasks(asignado_a, fecha_operativa);
CREATE INDEX IF NOT EXISTS idx_hk_tasks_estado ON public.housekeeping_tasks(estado);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_hk_tasks_updated_at ON public.housekeeping_tasks;
CREATE TRIGGER trigger_hk_tasks_updated_at
  BEFORE UPDATE ON public.housekeeping_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Incidencias con media
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.housekeeping_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  task_id uuid REFERENCES public.housekeeping_tasks(id),
  reportado_por uuid NOT NULL REFERENCES auth.users(id),
  tipo text NOT NULL CHECK (tipo IN ('rotura','suciedad','falta_insumo','mantenimiento','otro')),
  descripcion text,
  severidad text NOT NULL DEFAULT 'media' CHECK (severidad IN ('baja','media','alta','critica')),
  media_urls text[], -- URLs firmadas Storage (expiran 24h)
  estado text NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','en_proceso','resuelta','cerrada')),
  resuelta_por uuid REFERENCES auth.users(id),
  resuelta_en timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hk_incidents_hotel_fecha ON public.housekeeping_incidents(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hk_incidents_habitacion ON public.housekeeping_incidents(habitacion_id);
CREATE INDEX IF NOT EXISTS idx_hk_incidents_estado ON public.housekeeping_incidents(estado);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hk_tasks_all ON public.housekeeping_tasks;
CREATE POLICY hk_tasks_all ON public.housekeeping_tasks
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.housekeeping_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hk_incidents_all ON public.housekeeping_incidents;
CREATE POLICY hk_incidents_all ON public.housekeeping_incidents
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

-- ============================================================================
-- RPC para KPIs de housekeeping
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_housekeeping_kpis(
  p_hotel_id uuid,
  p_fecha_operativa date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'pendientes', COUNT(*) FILTER (WHERE estado = 'pendiente'),
    'en_progreso', COUNT(*) FILTER (WHERE estado = 'en_progreso'),
    'completadas', COUNT(*) FILTER (WHERE estado = 'completada'),
    'omitidas', COUNT(*) FILTER (WHERE estado = 'omitida'),
    'score_promedio', ROUND(AVG(puntuacion)::numeric, 1) FILTER (WHERE puntuacion IS NOT NULL),
    'total_habitaciones', COUNT(DISTINCT habitacion_id)
  )
  FROM public.housekeeping_tasks
  WHERE hotel_id = p_hotel_id
    AND fecha_operativa = p_fecha_operativa
$$;

GRANT EXECUTE ON FUNCTION public.get_housekeeping_kpis TO authenticated;

-- ============================================================================
-- RPC para completar tarea con scoring
-- ============================================================================

CREATE OR REPLACE FUNCTION public.complete_housekeeping_task(
  p_task_id uuid,
  p_checklist jsonb,
  p_puntuacion integer
) RETURNS public.housekeeping_tasks LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_task public.housekeeping_tasks;
BEGIN
  -- Validar puntuación
  IF p_puntuacion < 0 OR p_puntuacion > 100 THEN
    RAISE EXCEPTION 'Puntuación debe estar entre 0 y 100';
  END IF;

  UPDATE public.housekeeping_tasks
  SET
    estado = 'completada',
    checklist = p_checklist,
    puntuacion = p_puntuacion,
    completada_en = now(),
    updated_at = now()
  WHERE id = p_task_id
    AND hotel_id = get_user_hotel_id()
  RETURNING * INTO v_task;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tarea no encontrada o sin permisos';
  END IF;

  RETURN v_task;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_housekeeping_task TO authenticated;

-- ============================================================================
-- RPC para reportar incidencia
-- ============================================================================

CREATE OR REPLACE FUNCTION public.report_housekeeping_incident(
  p_habitacion_id uuid,
  p_tipo text,
  p_severidad text,
  p_descripcion text,
  p_media_urls text[] DEFAULT '{}',
  p_task_id uuid DEFAULT NULL
) RETURNS public.housekeeping_incidents LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_incident public.housekeeping_incidents;
  v_hotel_id uuid;
BEGIN
  -- Obtener hotel_id de la habitación
  SELECT hotel_id INTO v_hotel_id
  FROM public.habitaciones
  WHERE id = p_habitacion_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Habitación no encontrada';
  END IF;

  -- Validar hotel access
  IF v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para esta habitación';
  END IF;

  INSERT INTO public.housekeeping_incidents (
    hotel_id, habitacion_id, task_id, reportado_por,
    tipo, severidad, descripcion, media_urls, estado
  ) VALUES (
    v_hotel_id, p_habitacion_id, p_task_id, auth.uid(),
    p_tipo, p_severidad, p_descripcion, p_media_urls, 'abierta'
  ) RETURNING * INTO v_incident;

  RETURN v_incident;
END;
$$;

GRANT EXECUTE ON FUNCTION public.report_housekeeping_incident TO authenticated;

COMMENT ON MIGRATION IS 'Housekeeping Turntable: tasks, incidents, KPIs, scoring, RLS';