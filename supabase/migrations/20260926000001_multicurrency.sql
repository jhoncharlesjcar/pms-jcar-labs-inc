-- Migración: Multimoneda PEN/USD con tasa SUNAT (Semana 11-12)
-- Fecha: 2026-09-26
-- Feature: Soporte USD con tipo de cambio SUNAT diario vía Edge Function

-- ============================================================================
-- Tipo de cambio diario SUNAT (cache)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tipo_cambio_sunat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL UNIQUE,
  moneda_origen text NOT NULL DEFAULT 'USD',
  moneda_destino text NOT NULL DEFAULT 'PEN',
  tasa_compra numeric(10,4) NOT NULL, -- tasa compra SUNAT
  tasa_venta numeric(10,4) NOT NULL,  -- tasa venta SUNAT
  fuente text DEFAULT 'SUNAT',
  obtenido_en timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tc_fecha ON public.tipo_cambio_sunat(fecha DESC);

-- ============================================================================
-- Configuración moneda por hotel
-- ============================================================================

ALTER TABLE public.hoteles 
ADD COLUMN IF NOT EXISTS moneda_base text DEFAULT 'PEN' CHECK (moneda_base IN ('PEN','USD')),
ADD COLUMN IF NOT EXISTS monedas_aceptadas text[] DEFAULT ARRAY['PEN'];

-- ============================================================================
-- Comprobantes: agregar moneda y tasa
-- ============================================================================

ALTER TABLE public.comprobantes 
ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS tasa_cambio numeric(10,4),
ADD COLUMN IF NOT EXISTS total_moneda_base numeric(12,2);

-- Ventas: agregar moneda y tasa
ALTER TABLE public.ventas 
ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS tasa_cambio numeric(10,4);

-- Ventas POS: agregar moneda y tasa
ALTER TABLE public.ventas_pos 
ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS tasa_cambio numeric(10,4);

-- Cierres de caja: agregar moneda
ALTER TABLE public.cierres_caja 
ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN';

-- Egresos: agregar moneda y tasa
ALTER TABLE public.egresos 
ADD COLUMN IF NOT EXISTS moneda text DEFAULT 'PEN',
ADD COLUMN IF NOT EXISTS tasa_cambio numeric(10,4);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.tipo_cambio_sunat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tc_select ON public.tipo_cambio_sunat;
CREATE POLICY tc_select ON public.tipo_cambio_sunat
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS tc_admin ON public.tipo_cambio_sunat;
CREATE POLICY tc_admin ON public.tipo_cambio_sunat
  FOR ALL TO authenticated
  USING (get_user_role() = 'developer')
  WITH CHECK (get_user_role() = 'developer');

-- ============================================================================
-- RPC: Obtener tipo de cambio para fecha (usa cache, fallback a último)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tipo_cambio(
  p_fecha date DEFAULT CURRENT_DATE,
  p_moneda_origen text DEFAULT 'USD',
  p_moneda_destino text DEFAULT 'PEN'
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_tc RECORD;
BEGIN
  -- Buscar en cache
  SELECT * INTO v_tc
  FROM public.tipo_cambio_sunat
  WHERE fecha = p_fecha
    AND moneda_origen = p_moneda_origen
    AND moneda_destino = p_moneda_destino;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'fecha', v_tc.fecha,
      'moneda_origen', v_tc.moneda_origen,
      'moneda_destino', v_tc.moneda_destino,
      'tasa_compra', v_tc.tasa_compra,
      'tasa_venta', v_tc.tasa_venta,
      'fuente', v_tc.fuente,
      'cache_hit', true
    );
  END IF;

  -- Fallback: último valor conocido
  SELECT * INTO v_tc
  FROM public.tipo_cambio_sunat
  WHERE fecha < p_fecha
    AND moneda_origen = p_moneda_origen
    AND moneda_destino = p_moneda_destino
  ORDER BY fecha DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'fecha', v_tc.fecha,
      'moneda_origen', v_tc.moneda_origen,
      'moneda_destino', v_tc.moneda_destino,
      'tasa_compra', v_tc.tasa_compra,
      'tasa_venta', v_tc.tasa_venta,
      'fuente', v_tc.fuente || ' (fallback)',
      'cache_hit', false
    );
  END IF;

  -- Sin datos: retornar 1:1 como último recurso
  RETURN jsonb_build_object(
    'fecha', p_fecha,
    'moneda_origen', p_moneda_origen,
    'moneda_destino', p_moneda_destino,
    'tasa_compra', 1.0000,
    'tasa_venta', 1.0000,
    'fuente', 'default_fallback',
    'cache_hit', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tipo_cambio TO authenticated, anon;

-- ============================================================================
-- RPC: Convertir monto entre monedas
-- ============================================================================

CREATE OR REPLACE FUNCTION public.convertir_moneda(
  p_monto numeric,
  p_desde text,
  p_hacia text,
  p_fecha date DEFAULT CURRENT_DATE,
  p_tipo_tasa text DEFAULT 'venta' -- 'compra' | 'venta'
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_tc jsonb;
  v_tasa numeric;
BEGIN
  IF p_desde = p_hacia THEN
    RETURN p_monto;
  END IF;

  v_tc := public.get_tipo_cambio(p_fecha, p_desde, p_hacia);
  v_tasa := CASE WHEN p_tipo_tasa = 'compra' THEN (v_tc->>'tasa_compra')::numeric ELSE (v_tc->>'tasa_venta')::numeric END;

  RETURN ROUND(p_monto * v_tasa, 2);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convertir_moneda TO authenticated, anon;

-- ============================================================================
-- RPC: Obtener tasa para fecha específica (para comprobantes)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tasa_cambio_comprobante(
  p_fecha date
) RETURNS numeric LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT COALESCE(tasa_venta, 1.0000)
  FROM public.tipo_cambio_sunat
  WHERE fecha = p_fecha
    AND moneda_origen = 'USD'
    AND moneda_destino = 'PEN'
  UNION ALL
  SELECT COALESCE(tasa_venta, 1.0000)
  FROM public.tipo_cambio_sunat
  WHERE fecha < p_fecha
    AND moneda_origen = 'USD'
    AND moneda_destino = 'PEN'
  ORDER BY fecha DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_tasa_cambio_comprobante TO authenticated;

-- ============================================================================
-- Edge Function helper: fetch-sunat-rate (documentación)
-- ============================================================================

-- La Edge Function fetch-sunat-rate debe:
-- 1. Scrapear SUNAT o usar API oficial diariamente (cron 06:00 America/Lima)
-- 2. Insertar/actualizar en tipo_cambio_sunat
-- 3. Manejar fallback si SUNAT no disponible

COMMENT ON MIGRATION IS 'Multimoneda: tipo_cambio_sunat, hoteles.moneda_base/monedas_aceptadas, comprobantes/ventas/pos/caja/egresos con moneda y tasa, RPCs get_tipo_cambio, convertir_moneda, get_tasa_cambio_comprobante';