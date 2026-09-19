-- Migración: Split Payment + Pagos Parciales/Anticipados (Semana 12)
-- Fecha: 2026-09-27
-- Feature: Múltiples métodos de pago en un checkout + pagos parciales/anticipados ligados a reserva

-- ============================================================================
-- Pagos de reserva (parciales, anticipados, split)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reserva_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  monto numeric(10,2) NOT NULL,
  moneda text NOT NULL DEFAULT 'PEN',
  tasa_cambio numeric(10,4),
  metodo_pago text NOT NULL, -- 'efectivo','tarjeta','yape','plin','transferencia','mixto'
  referencia_externa text, -- ID transacción proveedor
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','rechazado','reembolsado')),
  tipo_pago text NOT NULL DEFAULT 'parcial' CHECK (tipo_pago IN ('anticipo','parcial','total','split')),
  grupo_pago_id uuid, -- agrupa pagos split de un mismo checkout
  notas text,
  creado_por uuid REFERENCES auth.users(id),
  creado_en timestamptz DEFAULT now(),
  confirmado_en timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rp_reserva ON public.reserva_pagos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_rp_grupo ON public.reserva_pagos(grupo_pago_id);
CREATE INDEX IF NOT EXISTS idx_rp_hotel_fecha ON public.reserva_pagos(hotel_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_rp_estado ON public.reserva_pagos(estado);

-- ============================================================================
-- Agregar saldo_pendiente a reservas
-- ============================================================================

ALTER TABLE public.reservas 
ADD COLUMN IF NOT EXISTS saldo_pendiente numeric(10,2) DEFAULT 0;

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.reserva_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rp_all ON public.reserva_pagos;
CREATE POLICY rp_all ON public.reserva_pagos
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

-- ============================================================================
-- RPC: Registrar anticipo
-- ============================================================================

CREATE OR REPLACE FUNCTION public.registrar_anticipo(
  p_reserva_id uuid,
  p_monto numeric,
  p_moneda text DEFAULT 'PEN',
  p_metodo_pago text,
  p_referencia_externa text DEFAULT NULL,
  p_notas text DEFAULT NULL
) RETURNS public.reserva_pagos LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_rp public.reserva_pagos;
  v_reserva public.reservas;
  v_hotel_id uuid;
  v_tasa numeric;
BEGIN
  IF p_monto <= 0 THEN
    RAISE EXCEPTION 'Monto debe ser mayor a 0';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  v_hotel_id := v_reserva.hotel_id;
  IF v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para esta reserva';
  END IF;

  -- Obtener tasa de cambio si es moneda extranjera
  IF p_moneda != 'PEN' THEN
    SELECT (public.get_tipo_cambio(CURRENT_DATE, p_moneda, 'PEN'))->>'tasa_venta' INTO v_tasa;
  ELSE
    v_tasa := 1.0000;
  END IF;

  INSERT INTO public.reserva_pagos (
    reserva_id, hotel_id, monto, moneda, tasa_cambio,
    metodo_pago, referencia_externa, estado, tipo_pago, notas, creado_por
  ) VALUES (
    p_reserva_id, v_hotel_id, p_monto, p_moneda, v_tasa,
    p_metodo_pago, p_referencia_externa, 'confirmado', 'anticipo', p_notas, auth.uid()
  ) RETURNING * INTO v_rp;

  -- Actualizar saldo_pendiente de la reserva
  UPDATE public.reservas
  SET saldo_pendiente = GREATEST(total - COALESCE((
    SELECT SUM(monto * COALESCE(tasa_cambio, 1)) 
    FROM public.reserva_pagos 
    WHERE reserva_id = p_reserva_id AND estado = 'confirmado'
  ), 0), 0)
  WHERE id = p_reserva_id;

  RETURN v_rp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_anticipo TO authenticated;

-- ============================================================================
-- RPC: Checkout con split payments (extiende checkout_reserva_atomic)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.checkout_reserva_split(
  p_reserva_id uuid,
  p_hotel_id uuid,
  p_user_id uuid,
  p_pagos jsonb, -- [{metodo, monto, moneda, referencia_externa}]
  p_venta jsonb DEFAULT NULL,
  p_loyalty jsonb DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_reserva public.reservas;
  v_total_pagado numeric := 0;
  v_grupo_pago_id uuid := gen_random_uuid();
  v_pago RECORD;
  v_tasa numeric;
  v_monto_base numeric;
  v_venta_id uuid;
  v_comprobante_id uuid;
BEGIN
  -- Validar permisos
  IF p_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para este hotel';
  END IF;

  -- Obtener reserva
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  IF v_reserva.hotel_id != p_hotel_id THEN
    RAISE EXCEPTION 'Reserva no pertenece a este hotel';
  END IF;

  -- Validar que la suma de pagos cubre el saldo pendiente
  FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
  LOOP
    v_monto_base := (v_pago->>'monto')::numeric * COALESCE((v_pago->>'tasa_cambio')::numeric, 
      CASE WHEN (v_pago->>'moneda') = 'PEN' THEN 1.0000 ELSE 
        (public.get_tipo_cambio(CURRENT_DATE, (v_pago->>'moneda')::text, 'PEN'))->>'tasa_venta'
      END);
    v_total_pagado := v_total_pagado + v_monto_base;
  END LOOP;

  IF v_total_pagado < COALESCE(v_reserva.saldo_pendiente, v_reserva.total) - 0.01 THEN
    RAISE EXCEPTION 'Pagos insuficientes. Saldo pendiente: %, Pagado: %', 
      COALESCE(v_reserva.saldo_pendiente, v_reserva.total), v_total_pagado;
  END IF;

  -- Registrar cada pago en reserva_pagos
  FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos)
  LOOP
    v_monto_base := (v_pago->>'monto')::numeric * COALESCE((v_pago->>'tasa_cambio')::numeric, 
      CASE WHEN (v_pago->>'moneda') = 'PEN' THEN 1.0000 ELSE 
        (public.get_tipo_cambio(CURRENT_DATE, (v_pago->>'moneda')::text, 'PEN'))->>'tasa_venta'
      END);

    IF (v_pago->>'moneda') != 'PEN' THEN
      v_tasa := COALESCE((v_pago->>'tasa_cambio')::numeric, 
        (public.get_tipo_cambio(CURRENT_DATE, (v_pago->>'moneda')::text, 'PEN'))->>'tasa_venta');
    ELSE
      v_tasa := 1.0000;
    END IF;

    INSERT INTO public.reserva_pagos (
      reserva_id, hotel_id, monto, moneda, tasa_cambio,
      metodo_pago, referencia_externa, estado, tipo_pago, grupo_pago_id, creado_por
    ) VALUES (
      p_reserva_id, p_hotel_id, (v_pago->>'monto')::numeric, (v_pago->>'moneda')::text, v_tasa,
      (v_pago->>'metodo')::text, (v_pago->>'referencia_externa')::text, 'confirmado', 'split', v_grupo_pago_id, p_user_id
    );
  END LOOP;

  -- Actualizar saldo_pendiente
  UPDATE public.reservas
  SET saldo_pendiente = 0,
      estado = 'finalizada'
  WHERE id = p_reserva_id;

  -- Si hay venta/POS asociada, procesar checkout atómico original
  IF p_venta IS NOT NULL THEN
    -- Llamar a checkout_reserva_atomic existente para la parte de venta
    SELECT checkout_reserva_atomic(p_reserva_id, p_hotel_id, p_user_id, p_venta, p_loyalty) INTO v_venta_id;
  END IF;

  -- Si hay anticipos previos, marcarlos como aplicados
  UPDATE public.reserva_pagos
  SET estado = 'confirmado',
      notas = COALESCE(notas, '') || ' [aplicado en checkout split ' || v_grupo_pago_id || ']'
  WHERE reserva_id = p_reserva_id AND tipo_pago = 'anticipo' AND estado = 'confirmado';

  RETURN jsonb_build_object(
    'success', true,
    'grupo_pago_id', v_grupo_pago_id,
    'total_pagado', v_total_pagado,
    'reserva_estado', 'finalizada',
    'saldo_pendiente', 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.checkout_reserva_split TO authenticated;

-- ============================================================================
-- RPC: Obtener pagos de reserva
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_reserva_pagos(
  p_reserva_id uuid
) RETURNS SETOF public.reserva_pagos LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT *
  FROM public.reserva_pagos
  WHERE reserva_id = p_reserva_id
    AND hotel_id = get_user_hotel_id()
  ORDER BY creado_en
$$;

GRANT EXECUTE ON FUNCTION public.get_reserva_pagos TO authenticated;

-- ============================================================================
-- RPC: Resumen de pagos para arqueo de caja
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pagos_resumen_caja(
  p_hotel_id uuid,
  p_fecha date DEFAULT CURRENT_DATE
) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT jsonb_build_object(
    'por_metodo', (
      SELECT jsonb_agg(jsonb_build_object(
        'metodo_pago', metodo_pago,
        'moneda', moneda,
        'cantidad', COUNT(*),
        'total_moneda_original', SUM(monto),
        'total_pen', SUM(monto * COALESCE(tasa_cambio, 1))
      ))
      FROM public.reserva_pagos
      WHERE hotel_id = p_hotel_id
        AND DATE(creado_en) = p_fecha
        AND estado = 'confirmado'
      GROUP BY metodo_pago, moneda
    ),
    'total_pen', COALESCE(SUM(monto * COALESCE(tasa_cambio, 1)), 0),
    'total_anticipos', COALESCE(SUM(monto * COALESCE(tasa_cambio, 1)) FILTER (WHERE tipo_pago = 'anticipo'), 0),
    'total_split', COALESCE(SUM(monto * COALESCE(tasa_cambio, 1)) FILTER (WHERE tipo_pago = 'split'), 0)
  )
  FROM public.reserva_pagos
  WHERE hotel_id = p_hotel_id
    AND DATE(creado_en) = p_fecha
    AND estado = 'confirmado'
$$;

GRANT EXECUTE ON FUNCTION public.get_pagos_resumen_caja TO authenticated;

COMMENT ON MIGRATION IS 'Split Payments: reserva_pagos table, saldo_pendiente en reservas, registrar_anticipo, checkout_reserva_split, get_reserva_pagos, get_pagos_resumen_caja';