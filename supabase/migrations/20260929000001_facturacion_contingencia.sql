-- Migración: Facturación Contingencia UI (Semana 12)
-- Fecha: 2026-09-29
-- Feature: UI para monitorear DLQ de facturación y retry manual con idempotencia

-- ============================================================================
-- Las tablas sunat_envios, comprobantes, comprobante_xml ya existen en migraciones anteriores
-- Esta migración añade índices, vistas y RPCs para la UI de contingencia
-- ============================================================================

-- ============================================================================
-- Índices para consultas de contingencia
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_sunat_envios_hotel_estado_fecha ON public.sunat_envios(hotel_id, estado, created_at);
CREATE INDEX IF NOT EXISTS idx_sunat_envios_comprobante ON public.sunat_envios(comprobante_id);
CREATE INDEX IF NOT EXISTS idx_sunat_envios_lease ON public.sunat_envios(lease_holder, lease_expires_at);

-- ============================================================================
-- Vista para UI de contingencia
-- ============================================================================

CREATE OR REPLACE VIEW public.v_facturacion_contingencia AS
SELECT 
  se.id as envio_id,
  se.hotel_id,
  h.nombre as hotel_nombre,
  c.id as comprobante_id,
  c.tipo_comprobante,
  c.serie,
  c.numero,
  c.fecha_emision,
  c.moneda,
  c.total as total_comprobante,
  c.cliente_razon_social,
  c.cliente_numero_documento,
  se.estado,
  se.intentos,
  se.lease_holder,
  se.lease_expires_at,
  se.created_at as envio_creado,
  se.updated_at as envio_actualizado,
  -- CDR info
  se.cdr_response_code,
  se.cdr_description,
  se.cdr_notes,
  -- XML hash for idempotency
  cx.xml_hash,
  -- Tiempo en cola
  EXTRACT(EPOCH FROM (now() - se.created_at))/60 as minutos_en_cola,
  -- Es dead letter?
  CASE 
    WHEN se.estado = 'dead_letter' THEN true
    WHEN se.intentos >= 3 AND se.estado IN ('pendiente', 'enviado') THEN true
    ELSE false
  END as es_dead_letter
FROM public.sunat_envios se
JOIN public.comprobantes c ON c.id = se.comprobante_id
JOIN public.hoteles h ON h.id = se.hotel_id
LEFT JOIN public.comprobante_xml cx ON cx.comprobante_id = c.id
WHERE se.estado IN ('pendiente', 'enviado', 'rechazado', 'dead_letter')
  AND se.hotel_id = get_user_hotel_id();

-- ============================================================================
-- RLS para vista (se hereda de tablas base)
-- ============================================================================

ALTER VIEW public.v_facturacion_contingencia SET (security_invoker = true);

-- ============================================================================
-- RPC: Reintentar envío (respeta idempotencia)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.retry_facturacion_envio(
  p_envio_id uuid
) RETURNS public.sunat_envios LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_envio public.sunat_envios;
  v_comprobante public.comprobantes;
BEGIN
  -- Obtener envío con lock
  SELECT * INTO v_envio
  FROM public.sunat_envios
  WHERE id = p_envio_id
    AND hotel_id = get_user_hotel_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envío no encontrado o sin permisos';
  END IF;

  -- Solo permitir retry en estados válidos
  IF v_envio.estado NOT IN ('pendiente', 'enviado', 'rechazado', 'dead_letter') THEN
    RAISE EXCEPTION 'Estado no permite reintento: %', v_envio.estado;
  END IF;

  -- Obtener comprobante para validar
  SELECT * INTO v_comprobante
  FROM public.comprobantes
  WHERE id = v_envio.comprobante_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comprobante no encontrado';
  END IF;

  -- Verificar idempotencia: si ya fue aceptado por SUNAT, no reintentar
  IF v_envio.estado = 'aceptado' THEN
    RAISE EXCEPTION 'Comprobante ya aceptado por SUNAT (CDR: %)', v_envio.cdr_response_code;
  END IF;

  -- Resetear estado para que facturacion-worker lo recoja
  UPDATE public.sunat_envios
  SET estado = 'pendiente',
      intentos = intentos + 1,
      lease_holder = NULL,
      lease_expires_at = NULL,
      updated_at = now()
  WHERE id = p_envio_id
  RETURNING * INTO v_envio;

  -- Notificar al worker (si usa pg_notify)
  PERFORM pg_notify('facturacion_pending', jsonb_build_object(
    'envio_id', p_envio_id,
    'comprobante_id', v_envio.comprobante_id,
    'retry', true
  )::text);

  RETURN v_envio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.retry_facturacion_envio TO authenticated;

-- ============================================================================
-- RPC: Forzar requeue desde DLQ (solo admin/developer)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.force_requeue_facturacion(
  p_envio_id uuid
) RETURNS public.sunat_envios LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_envio public.sunat_envios;
BEGIN
  -- Validar rol
  IF get_user_role() NOT IN ('developer', 'admin') THEN
    RAISE EXCEPTION 'Solo developer/admin puede forzar requeue desde DLQ';
  END IF;

  SELECT * INTO v_envio
  FROM public.sunat_envios
  WHERE id = p_envio_id
    AND hotel_id = get_user_hotel_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envío no encontrado o sin permisos';
  END IF;

  IF v_envio.estado != 'dead_letter' THEN
    RAISE EXCEPTION 'Solo se puede forzar requeue desde dead_letter, estado actual: %', v_envio.estado;
  END IF;

  -- Resetear a pendiente con intentos = 0 para nuevo ciclo
  UPDATE public.sunat_envios
  SET estado = 'pendiente',
      intentos = 0,
      lease_holder = NULL,
      lease_expires_at = NULL,
      cdr_response_code = NULL,
      cdr_description = NULL,
      cdr_notes = NULL,
      updated_at = now()
  WHERE id = p_envio_id
  RETURNING * INTO v_envio;

  -- Log en auditoría
  PERFORM public.write_audit_event(
    get_user_hotel_id(),
    'facturacion_force_requeue',
    'facturacion',
    'sunat_envios',
    p_envio_id::text,
    'Forzado requeue manual desde DLQ',
    jsonb_build_object('envio_id', p_envio_id, 'usuario', auth.uid()),
    gen_random_uuid()::text
  );

  -- Notificar worker
  PERFORM pg_notify('facturacion_pending', jsonb_build_object(
    'envio_id', p_envio_id,
    'comprobante_id', v_envio.comprobante_id,
    'force_requeue', true
  )::text);

  RETURN v_envio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_requeue_facturacion TO authenticated;

-- ============================================================================
-- RPC: Obtener detalle completo para modal
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_facturacion_detalle(
  p_envio_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'envio', jsonb_build_object(
      'id', se.id,
      'estado', se.estado,
      'intentos', se.intentos,
      'lease_holder', se.lease_holder,
      'lease_expires_at', se.lease_expires_at,
      'created_at', se.created_at,
      'updated_at', se.updated_at,
      'cdr_response_code', se.cdr_response_code,
      'cdr_description', se.cdr_description,
      'cdr_notes', se.cdr_notes
    ),
    'comprobante', jsonb_build_object(
      'id', c.id,
      'tipo_comprobante', c.tipo_comprobante,
      'serie', c.serie,
      'numero', c.numero,
      'fecha_emision', c.fecha_emision,
      'moneda', c.moneda,
      'total', c.total,
      'cliente_razon_social', c.cliente_razon_social,
      'cliente_numero_documento', c.cliente_numero_documento,
      'cliente_direccion', c.cliente_direccion
    ),
    'xml', (
      SELECT jsonb_build_object(
        'xml_hash', cx.xml_hash,
        'xml_content', cx.xml_content,
        'firmado_en', cx.firmado_en
      )
      FROM public.comprobante_xml cx WHERE cx.comprobante_id = c.id
    ),
    'hotel', jsonb_build_object(
      'id', h.id,
      'nombre', h.nombre,
      'ruc', h.ruc,
      'direccion', h.direccion
    )
  ) INTO v_result
  FROM public.sunat_envios se
  JOIN public.comprobantes c ON c.id = se.comprobante_id
  JOIN public.hoteles h ON h.id = se.hotel_id
  WHERE se.id = p_envio_id
    AND se.hotel_id = get_user_hotel_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Envío no encontrado';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_facturacion_detalle TO authenticated;

-- ============================================================================
-- RPC: KPIs de facturación para dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_facturacion_kpis(
  p_hotel_id uuid DEFAULT NULL,
  p_desde timestamptz DEFAULT (now() - INTERVAL '24 hours'),
  p_hasta timestamptz DEFAULT now()
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'pendientes', COUNT(*) FILTER (WHERE estado = 'pendiente'),
    'enviados', COUNT(*) FILTER (WHERE estado = 'enviado'),
    'aceptados', COUNT(*) FILTER (WHERE estado = 'aceptado'),
    'rechazados', COUNT(*) FILTER (WHERE estado = 'rechazado'),
    'dead_letter', COUNT(*) FILTER (WHERE estado = 'dead_letter'),
    'pendientes_1h', COUNT(*) FILTER (WHERE estado IN ('pendiente', 'enviado') AND created_at < now() - INTERVAL '1 hour'),
    'tasa_aceptacion_24h', CASE 
      WHEN COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') > 0 THEN
        ROUND(
          COUNT(*) FILTER (WHERE estado = 'aceptado' AND created_at >= now() - INTERVAL '24 hours')::numeric 
          / COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') * 100, 2
        )
      ELSE 0
    END,
    'por_tipo', (
      SELECT jsonb_agg(jsonb_build_object(
        'tipo_comprobante', c.tipo_comprobante,
        'total', COUNT(*),
        'aceptados', COUNT(*) FILTER (WHERE se.estado = 'aceptado'),
        'rechazados', COUNT(*) FILTER (WHERE se.estado = 'rechazado')
      ))
      FROM public.sunat_envios se
      JOIN public.comprobantes c ON c.id = se.comprobante_id
      WHERE se.hotel_id = get_user_hotel_id()
        AND se.created_at BETWEEN p_desde AND p_hasta
      GROUP BY c.tipo_comprobante
    )
  )
  FROM public.sunat_envios se
  JOIN public.comprobantes c ON c.id = se.comprobante_id
  WHERE se.hotel_id = get_user_hotel_id()
    AND se.created_at BETWEEN p_desde AND p_hasta
$$;

GRANT EXECUTE ON FUNCTION public.get_facturacion_kpis TO authenticated;

COMMENT ON MIGRATION IS 'Facturación Contingencia: v_facturacion_contingencia view, retry_facturacion_envio (idempotente), force_requeue_facturacion (admin), get_facturacion_detalle, get_facturacion_kpis';