-- Migración: Minibar & Consumos con Stock (Semana 5)
-- Fecha: 2026-09-21
-- Feature: Gestión de minibar por habitación con stock en tiempo real, QR reposición, bloqueo venta si stock ≤0

-- ============================================================================
-- Items de minibar configurables por hotel
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.minibar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  producto_id uuid NOT NULL REFERENCES public.productos(id),
  habitacion_tipo_id uuid REFERENCES public.habitaciones(id), -- NULL = aplica a todas
  stock_actual integer NOT NULL DEFAULT 0,
  stock_minimo integer NOT NULL DEFAULT 1,
  precio_venta numeric(10,2) NOT NULL,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, producto_id, habitacion_tipo_id)
);

CREATE INDEX IF NOT EXISTS idx_minibar_hotel ON public.minibar_items(hotel_id, activo);
CREATE INDEX IF NOT EXISTS idx_minibar_producto ON public.minibar_items(producto_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trigger_minibar_items_updated_at ON public.minibar_items;
CREATE TRIGGER trigger_minibar_items_updated_at
  BEFORE UPDATE ON public.minibar_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Consumos por habitación/estancia
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.minibar_consumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id),
  habitacion_id uuid NOT NULL REFERENCES public.habitaciones(id),
  minibar_item_id uuid NOT NULL REFERENCES public.minibar_items(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  consumido_en timestamptz DEFAULT now(),
  consumido_por uuid REFERENCES auth.users(id),
  facturado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minibar_consumos_reserva ON public.minibar_consumos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_minibar_consumos_hotel_fecha ON public.minibar_consumos(hotel_id, consumido_en);
CREATE INDEX IF NOT EXISTS idx_minibar_consumos_item ON public.minibar_consumos(minibar_item_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.minibar_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS minibar_items_all ON public.minibar_items;
CREATE POLICY minibar_items_all ON public.minibar_items
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

ALTER TABLE public.minibar_consumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS minibar_consumos_all ON public.minibar_consumos;
CREATE POLICY minibar_consumos_all ON public.minibar_consumos
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id())
  WITH CHECK (hotel_id = get_user_hotel_id());

-- ============================================================================
-- RPC para consumir minibar (valida stock y descuenta)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_minibar_item(
  p_reserva_id uuid,
  p_habitacion_id uuid,
  p_minibar_item_id uuid,
  p_cantidad integer DEFAULT 1
) RETURNS public.minibar_consumos LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_item public.minibar_items;
  v_consumo public.minibar_consumos;
  v_hotel_id uuid;
  v_precio numeric(10,2);
BEGIN
  -- Validar cantidad
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
  END IF;

  -- Obtener item y validar stock
  SELECT * INTO v_item
  FROM public.minibar_items
  WHERE id = p_minibar_item_id
    AND hotel_id = get_user_hotel_id()
    AND activo = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de minibar no encontrado o inactivo';
  END IF;

  IF v_item.stock_actual < p_cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %', v_item.stock_actual, p_cantidad;
  END IF;

  -- Obtener hotel_id de la reserva
  SELECT hotel_id INTO v_hotel_id
  FROM public.reservas
  WHERE id = p_reserva_id;

  IF v_hotel_id IS NULL OR v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Reserva no encontrada o sin permisos';
  END IF;

  -- Validar que la habitación corresponde a la reserva
  IF NOT EXISTS (
    SELECT 1 FROM public.reservas
    WHERE id = p_reserva_id AND habitacion_id = p_habitacion_id
  ) THEN
    RAISE EXCEPTION 'La habitación no corresponde a esta reserva';
  END IF;

  -- Descontar stock y registrar consumo en una transacción
  v_precio := v_item.precio_venta;

  UPDATE public.minibar_items
  SET stock_actual = stock_actual - p_cantidad,
      updated_at = now()
  WHERE id = p_minibar_item_id;

  INSERT INTO public.minibar_consumos (
    hotel_id, reserva_id, habitacion_id, minibar_item_id,
    cantidad, precio_unitario, consumido_por
  ) VALUES (
    v_hotel_id, p_reserva_id, p_habitacion_id, p_minibar_item_id,
    p_cantidad, v_precio, auth.uid()
  ) RETURNING * INTO v_consumo;

  RETURN v_consumo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_minibar_item TO authenticated;

-- ============================================================================
-- RPC para reposición (incrementa stock)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.restock_minibar_item(
  p_minibar_item_id uuid,
  p_cantidad integer
) RETURNS public.minibar_items LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_item public.minibar_items;
BEGIN
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
  END IF;

  UPDATE public.minibar_items
  SET stock_actual = stock_actual + p_cantidad,
      updated_at = now()
  WHERE id = p_minibar_item_id
    AND hotel_id = get_user_hotel_id()
  RETURNING * INTO v_item;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item no encontrado o sin permisos';
  END IF;

  RETURN v_item;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restock_minibar_item TO authenticated;

-- ============================================================================
-- RPC para generar QR de reposición por piso
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_minibar_restock_qr(
  p_hotel_id uuid,
  p_piso integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_qr_token text;
  v_expires_at timestamptz;
  v_items jsonb;
BEGIN
  -- Validar acceso al hotel
  IF p_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para este hotel';
  END IF;

  -- Generar token único (usar gen_random_uuid o similar)
  v_qr_token := encode(gen_random_bytes(16), 'hex');
  v_expires_at := now() + INTERVAL '24 hours';

  -- Obtener items con stock bajo en ese piso
  SELECT jsonb_agg(jsonb_build_object(
    'item_id', mi.id,
    'producto', p.nombre,
    'stock_actual', mi.stock_actual,
    'stock_minimo', mi.stock_minimo,
    'habitaciones', h_ids
  )) INTO v_items
  FROM public.minibar_items mi
  JOIN public.productos p ON p.id = mi.producto_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(h.id) as h_ids
    FROM public.habitaciones h
    WHERE h.hotel_id = p_hotel_id
      AND h.piso = p_piso
      AND (mi.habitacion_tipo_id IS NULL OR h.tipo = (SELECT tipo FROM public.habitaciones WHERE id = mi.habitacion_tipo_id))
  ) h ON true
  WHERE mi.hotel_id = p_hotel_id
    AND mi.activo = true
    AND mi.stock_actual <= mi.stock_minimo
  GROUP BY p_piso;

  -- Guardar token en tabla temporal o cache (simplificado: retornar para generar QR en frontend)
  RETURN jsonb_build_object(
    'token', v_qr_token,
    'expires_at', v_expires_at,
    'piso', p_piso,
    'items_para_reponer', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_minibar_restock_qr TO authenticated;

-- ============================================================================
-- Función helper para validar stock en POS/Recepción
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_minibar_stock(
  p_hotel_id uuid,
  p_producto_id uuid,
  p_cantidad integer DEFAULT 1,
  p_habitacion_tipo_id uuid DEFAULT NULL
) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.minibar_items
    WHERE hotel_id = p_hotel_id
      AND producto_id = p_producto_id
      AND (habitacion_tipo_id IS NULL OR habitacion_tipo_id = p_habitacion_tipo_id)
      AND activo = true
      AND stock_actual >= p_cantidad
  )
$$;

GRANT EXECUTE ON FUNCTION public.check_minibar_stock TO authenticated;

COMMENT ON MIGRATION IS 'Minibar & Consumos: items con stock, consumos atómicos, reposición QR, validación stock POS';