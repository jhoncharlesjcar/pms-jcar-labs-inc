-- Migración: CRM Huéspedes + Segmentos WhatsApp (Semana 12)
-- Fecha: 2026-09-28
-- Feature: Historial completo, tags VIP/blacklist, segmentos para campañas WhatsApp opt-in

-- ============================================================================
-- Tags de huésped
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.huesped_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  color text DEFAULT '#6366f1',
  tipo text NOT NULL CHECK (tipo IN ('vip','blacklist','preferencia','alerta','custom')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, nombre)
);

CREATE INDEX IF NOT EXISTS idx_huesped_tags_hotel ON public.huesped_tags(hotel_id);

-- ============================================================================
-- Tags asignados a huéspedes
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.huesped_tags_asignados (
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.huesped_tags(id),
  asignado_por uuid REFERENCES auth.users(id),
  asignado_en timestamptz DEFAULT now(),
  notas text,
  PRIMARY KEY (hotel_id, tipo_documento, numero_documento, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_hta_documento ON public.huesped_tags_asignados(tipo_documento, numero_documento);
CREATE INDEX IF NOT EXISTS idx_hta_tag ON public.huesped_tags_asignados(tag_id);

-- ============================================================================
-- Opt-in WhatsApp
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.huesped_whatsapp_optin (
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  tipo_documento text NOT NULL,
  numero_documento text NOT NULL,
  telefono text NOT NULL, -- formato E.164: +519XXXXXXXXX
  optin boolean DEFAULT false,
  optin_en timestamptz,
  optout_en timestamptz,
  canal text DEFAULT 'whatsapp',
  fuente text, -- 'recepcion', 'booking', 'portal', 'manual'
  PRIMARY KEY (hotel_id, tipo_documento, numero_documento)
);

CREATE INDEX IF NOT EXISTS idx_hwo_telefono ON public.huesped_whatsapp_optin(telefono);
CREATE INDEX IF NOT EXISTS idx_hwo_optin ON public.huesped_whatsapp_optin(optin);

-- ============================================================================
-- Segmentos dinámicos (para campañas)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.huesped_segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  descripcion text,
  criterios jsonb NOT NULL, -- JSON con reglas: {field, operator, value}[]
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hs_hotel_activo ON public.huesped_segmentos(hotel_id, activo);

DROP TRIGGER IF EXISTS trigger_hs_updated_at ON public.huesped_segmentos;
CREATE TRIGGER trigger_hs_updated_at
  BEFORE UPDATE ON public.huesped_segmentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.huesped_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ht_all ON public.huesped_tags;
CREATE POLICY ht_all ON public.huesped_tags
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.huesped_tags_asignados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hta_all ON public.huesped_tags_asignados;
CREATE POLICY hta_all ON public.huesped_tags_asignados
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.huesped_whatsapp_optin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hwo_all ON public.huesped_whatsapp_optin;
CREATE POLICY hwo_all ON public.huesped_whatsapp_optin
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.huesped_segmentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hs_all ON public.huesped_segmentos;
CREATE POLICY hs_all ON public.huesped_segmentos
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

-- ============================================================================
-- RPC: Asignar/quitar tag a huésped
-- ============================================================================

CREATE OR REPLACE FUNCTION public.asignar_tag_huesped(
  p_tipo_documento text,
  p_numero_documento text,
  p_tag_id uuid,
  p_notas text DEFAULT NULL
) RETURNS public.huesped_tags_asignados LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hta public.huesped_tags_asignados;
  v_hotel_id uuid;
BEGIN
  -- Obtener hotel_id del tag
  SELECT hotel_id INTO v_hotel_id FROM public.huesped_tags WHERE id = p_tag_id;
  
  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Tag no encontrado';
  END IF;

  IF v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para este tag';
  END IF;

  INSERT INTO public.huesped_tags_asignados (
    hotel_id, tipo_documento, numero_documento, tag_id, asignado_por, notas
  ) VALUES (
    v_hotel_id, p_tipo_documento, p_numero_documento, p_tag_id, auth.uid(), p_notas
  )
  ON CONFLICT (hotel_id, tipo_documento, numero_documento, tag_id) DO UPDATE SET
    asignado_por = EXCLUDED.asignado_por,
    asignado_en = now(),
    notas = EXCLUDED.notas
  RETURNING * INTO v_hta;

  RETURN v_hta;
END;
$$;

GRANT EXECUTE ON FUNCTION public.asignar_tag_huesped TO authenticated;

CREATE OR REPLACE FUNCTION public.quitar_tag_huesped(
  p_tipo_documento text,
  p_numero_documento text,
  p_tag_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id FROM public.huesped_tags WHERE id = p_tag_id;
  
  IF v_hotel_id IS NULL OR v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Tag no encontrado o sin permisos';
  END IF;

  DELETE FROM public.huesped_tags_asignados
  WHERE hotel_id = v_hotel_id
    AND tipo_documento = p_tipo_documento
    AND numero_documento = p_numero_documento
    AND tag_id = p_tag_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tag no estaba asignado a este huésped';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quitar_tag_huesped TO authenticated;

-- ============================================================================
-- RPC: Toggle WhatsApp opt-in
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_whatsapp_optin(
  p_tipo_documento text,
  p_numero_documento text,
  p_telefono text,
  p_optin boolean,
  p_fuente text DEFAULT 'recepcion'
) RETURNS public.huesped_whatsapp_optin LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hwo public.huesped_whatsapp_optin;
  v_hotel_id uuid := get_user_hotel_id();
BEGIN
  IF p_optin THEN
    INSERT INTO public.huesped_whatsapp_optin (
      hotel_id, tipo_documento, numero_documento, telefono, optin, optin_en, fuente
    ) VALUES (
      v_hotel_id, p_tipo_documento, p_numero_documento, p_telefono, true, now(), p_fuente
    )
    ON CONFLICT (hotel_id, tipo_documento, numero_documento) DO UPDATE SET
      telefono = EXCLUDED.telefono,
      optin = true,
      optin_en = now(),
      optout_en = NULL,
      fuente = EXCLUDED.fuente
    RETURNING * INTO v_hwo;
  ELSE
    UPDATE public.huesped_whatsapp_optin
    SET optin = false, optout_en = now()
    WHERE hotel_id = v_hotel_id
      AND tipo_documento = p_tipo_documento
      AND numero_documento = p_numero_documento
    RETURNING * INTO v_hwo;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Registro de opt-in no encontrado';
    END IF;
  END IF;

  RETURN v_hwo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_whatsapp_optin TO authenticated;

-- ============================================================================
-- RPC: Evaluar segmento y obtener miembros
-- ============================================================================

CREATE OR REPLACE FUNCTION public.evaluar_segmento_huespedes(
  p_segmento_id uuid
) RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_segmento public.huesped_segmentos;
  v_criterio RECORD;
  v_query text;
  v_where_clause text := 'WHERE la.hotel_id = $1';
  v_params jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_segmento FROM public.huesped_segmentos WHERE id = p_segmento_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Segmento no encontrado';
  END IF;

  IF v_segmento.hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para este segmento';
  END IF;

  -- Construir WHERE dinámico basado en criterios
  -- criterios formato: [{"field": "total_estancias", "operator": ">=", "value": 5}, ...]
  FOR v_criterio IN SELECT * FROM jsonb_array_elements(v_segmento.criterios)
  LOOP
    CASE v_criterio->>'field'
      WHEN 'total_estancias' THEN
        v_where_clause := v_where_clause || ' AND (
          SELECT COUNT(*) FROM public.reservas r 
          WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
        ) ' || v_criterio->>'operator' || ' ' || v_criterio->>'value';
      WHEN 'valor_total' THEN
        v_where_clause := v_where_clause || ' AND (
          SELECT COALESCE(SUM(r.total), 0) FROM public.reservas r 
          WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
        ) ' || v_criterio->>'operator' || ' ' || v_criterio->>'value';
      WHEN 'ultima_estancia_dias' THEN
        v_where_clause := v_where_clause || ' AND (
          SELECT MAX(r.fecha_entrada) FROM public.reservas r 
          WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
        ) >= CURRENT_DATE - INTERVAL ''' || v_criterio->>'value' || ' days''';
      WHEN 'tiene_tag' THEN
        v_where_clause := v_where_clause || ' AND EXISTS (
          SELECT 1 FROM public.huesped_tags_asignados hta
          WHERE hta.hotel_id = la.hotel_id
            AND hta.tipo_documento = la.tipo_documento
            AND hta.numero_documento = la.numero_documento
            AND hta.tag_id = ''' || v_criterio->>'value' || '''::uuid
        )';
      WHEN 'whatsapp_optin' THEN
        v_where_clause := v_where_clause || ' AND EXISTS (
          SELECT 1 FROM public.huesped_whatsapp_optin hwo
          WHERE hwo.hotel_id = la.hotel_id
            AND hwo.tipo_documento = la.tipo_documento
            AND hwo.numero_documento = la.numero_documento
            AND hwo.optin = true
        )';
    END CASE;
  END LOOP;

  -- Ejecutar query dinámica
  RETURN QUERY EXECUTE format('
    SELECT jsonb_build_object(
      ''tipo_documento'', la.tipo_documento,
      ''numero_documento'', la.numero_documento,
      ''nombre'', la.nombre,
      ''telefono'', hwo.telefono,
      ''tags'', (
        SELECT jsonb_agg(jsonb_build_object(
          ''id'', ht.id, ''nombre'', ht.nombre, ''color'', ht.color, ''tipo'', ht.tipo
        ))
        FROM public.huesped_tags_asignados hta
        JOIN public.huesped_tags ht ON ht.id = hta.tag_id
        WHERE hta.hotel_id = la.hotel_id
          AND hta.tipo_documento = la.tipo_documento
          AND hta.numero_documento = la.numero_documento
      ),
      ''whatsapp_optin'', COALESCE(hwo.optin, false),
      ''ultima_estancia'', (
        SELECT MAX(r.fecha_entrada) FROM public.reservas r 
        WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
      ),
      ''total_estancias'', (
        SELECT COUNT(*) FROM public.reservas r 
        WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
      ),
      ''valor_total'', (
        SELECT COALESCE(SUM(r.total), 0) FROM public.reservas r 
        WHERE r.huesped_dni = la.numero_documento AND r.hotel_id = la.hotel_id
      )
    )
    FROM public.loyalty_accounts la
    LEFT JOIN public.huesped_whatsapp_optin hwo ON hwo.hotel_id = la.hotel_id
      AND hwo.tipo_documento = la.tipo_documento
      AND hwo.numero_documento = la.numero_documento
    %s
  ', v_where_clause)
  USING v_segmento.hotel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluar_segmento_huespedes TO authenticated;

-- ============================================================================
-- RPC: Obtener tags de un huésped
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_huesped_tags(
  p_tipo_documento text,
  p_numero_documento text
) RETURNS SETOF public.huesped_tags LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT ht.*
  FROM public.huesped_tags ht
  JOIN public.huesped_tags_asignados hta ON hta.tag_id = ht.id
  WHERE hta.hotel_id = get_user_hotel_id()
    AND hta.tipo_documento = p_tipo_documento
    AND hta.numero_documento = p_numero_documento
$$;

GRANT EXECUTE ON FUNCTION public.get_huesped_tags TO authenticated;

-- ============================================================================
-- RPC: Obtener opt-in WhatsApp
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_whatsapp_optin(
  p_tipo_documento text,
  p_numero_documento text
) RETURNS public.huesped_whatsapp_optin LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT *
  FROM public.huesped_whatsapp_optin
  WHERE hotel_id = get_user_hotel_id()
    AND tipo_documento = p_tipo_documento
    AND numero_documento = p_numero_documento
$$;

GRANT EXECUTE ON FUNCTION public.get_whatsapp_optin TO authenticated;

COMMENT ON MIGRATION IS 'CRM Huéspedes: tags VIP/blacklist/preferencia, WhatsApp opt-in E.164, segmentos dinámicos con criterios JSON, RPCs asignar/quitar tag, toggle opt-in, evaluar segmento';