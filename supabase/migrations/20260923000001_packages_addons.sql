-- Migración: Paquetes/Add-ons en Booking Público (Semana 7)
-- Fecha: 2026-09-23
-- Feature: Paquetes vendibles (desayuno, late checkout, traslado) con precio fijo o %, adjuntos a reserva en booking público.

-- ============================================================================
-- Paquetes configurables por hotel
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.paquetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id),
  nombre text NOT NULL,
  descripcion text,
  tipo text NOT NULL CHECK (tipo IN ('desayuno','late_checkout','traslado','spa','otro')),
  precio_tipo text NOT NULL CHECK (precio_tipo IN ('fijo','porcentaje_estadia','por_noche','por_persona')),
  precio_valor numeric(10,2) NOT NULL, -- monto fijo o % (ej 15.00 = 15% o S/ 50.00)
  moneda text DEFAULT 'PEN',
  activo boolean DEFAULT true,
  requiere_confirmacion boolean DEFAULT false, -- ej traslado necesita coordinación
  imagen_url text,
  orden integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paquetes_hotel_activo ON public.paquetes(hotel_id, activo);
CREATE INDEX IF NOT EXISTS idx_paquetes_tipo ON public.paquetes(tipo);

DROP TRIGGER IF EXISTS trigger_paquetes_updated_at ON public.paquetes;
CREATE TRIGGER trigger_paquetes_updated_at
  BEFORE UPDATE ON public.paquetes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- Paquetes en reserva
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reserva_paquetes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE CASCADE,
  paquete_id uuid NOT NULL REFERENCES public.paquetes(id),
  cantidad integer NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL, -- precio al momento de agregar
  subtotal numeric(10,2) NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmado','cancelado')),
  notas text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reserva_paquetes_reserva ON public.reserva_paquetes(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_paquetes_paquete ON public.reserva_paquetes(paquete_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE public.paquetes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS paquetes_select ON public.paquetes;
CREATE POLICY paquetes_select ON public.paquetes
  FOR SELECT TO anon, authenticated
  USING (hotel_id = get_user_hotel_id() AND activo = true);

DROP POLICY IF EXISTS paquetes_admin ON public.paquetes;
CREATE POLICY paquetes_admin ON public.paquetes
  FOR ALL TO authenticated
  USING (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'))
  WITH CHECK (hotel_id = get_user_hotel_id() AND get_user_role() IN ('developer','admin'));

ALTER TABLE public.reserva_paquetes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rp_all ON public.reserva_paquetes;
CREATE POLICY rp_all ON public.reserva_paquetes
  FOR ALL TO authenticated
  USING (
    reserva_id IN (SELECT id FROM public.reservas WHERE hotel_id = get_user_hotel_id())
  )
  WITH CHECK (
    reserva_id IN (SELECT id FROM public.reservas WHERE hotel_id = get_user_hotel_id())
  );

-- ============================================================================
-- RPC: Calcular precio de paquete para reserva
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_package_price(
  p_paquete_id uuid,
  p_reserva_id uuid
) RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_paquete public.paquetes;
  v_reserva public.reservas;
  v_precio numeric;
BEGIN
  SELECT * INTO v_paquete FROM public.paquetes WHERE id = p_paquete_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paquete no encontrado';
  END IF;

  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  CASE v_paquete.precio_tipo
    WHEN 'fijo' THEN
      v_precio := v_paquete.precio_valor;
    WHEN 'porcentaje_estadia' THEN
      v_precio := v_reserva.total * v_paquete.precio_valor / 100;
    WHEN 'por_noche' THEN
      v_precio := v_paquete.precio_valor * v_reserva.noches;
    WHEN 'por_persona' THEN
      v_precio := v_paquete.precio_valor * (v_reserva.num_adultos + v_reserva.num_ninos);
    ELSE
      v_precio := 0;
  END CASE;

  RETURN v_precio;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_package_price TO authenticated, anon;

-- ============================================================================
-- RPC: Añadir paquete a reserva (booking público o recepción)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_package_to_reservation(
  p_reserva_id uuid,
  p_paquete_id uuid,
  p_cantidad integer DEFAULT 1
) RETURNS public.reserva_paquetes LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_rp public.reserva_paquetes;
  v_precio_unitario numeric;
  v_hotel_id uuid;
BEGIN
  IF p_cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0';
  END IF;

  -- Obtener hotel_id de la reserva
  SELECT hotel_id INTO v_hotel_id
  FROM public.reservas
  WHERE id = p_reserva_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  -- Validar acceso (anon puede en booking público, authenticated en recepción)
  IF current_setting('role') != 'anon' AND v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para esta reserva';
  END IF;

  -- Validar que el paquete pertenece al hotel y está activo
  IF NOT EXISTS (
    SELECT 1 FROM public.paquetes
    WHERE id = p_paquete_id AND hotel_id = v_hotel_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'Paquete no disponible';
  END IF;

  -- Calcular precio
  v_precio_unitario := public.calculate_package_price(p_paquete_id, p_reserva_id);

  -- Insertar o actualizar si ya existe
  INSERT INTO public.reserva_paquetes (
    reserva_id, paquete_id, cantidad, precio_unitario, subtotal, estado
  ) VALUES (
    p_reserva_id, p_paquete_id, p_cantidad, v_precio_unitario,
    v_precio_unitario * p_cantidad, 'pendiente'
  )
  ON CONFLICT (reserva_id, paquete_id) DO UPDATE SET
    cantidad = EXCLUDED.cantidad,
    precio_unitario = EXCLUDED.precio_unitario,
    subtotal = EXCLUDED.subtotal
  RETURNING * INTO v_rp;

  RETURN v_rp;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_package_to_reservation TO authenticated, anon;

-- ============================================================================
-- RPC: Quitar paquete de reserva
-- ============================================================================

CREATE OR REPLACE FUNCTION public.remove_package_from_reservation(
  p_reserva_id uuid,
  p_paquete_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_hotel_id uuid;
BEGIN
  SELECT hotel_id INTO v_hotel_id
  FROM public.reservas
  WHERE id = p_reserva_id;

  IF v_hotel_id IS NULL THEN
    RAISE EXCEPTION 'Reserva no encontrada';
  END IF;

  IF current_setting('role') != 'anon' AND v_hotel_id != get_user_hotel_id() THEN
    RAISE EXCEPTION 'Sin permisos para esta reserva';
  END IF;

  DELETE FROM public.reserva_paquetes
  WHERE reserva_id = p_reserva_id AND paquete_id = p_paquete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Paquete no estaba en la reserva';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_package_from_reservation TO authenticated, anon;

-- ============================================================================
-- RPC: Obtener paquetes disponibles para reserva (booking público)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_packages_for_reservation(
  p_hotel_id uuid,
  p_reserva_id uuid DEFAULT NULL
) RETURNS SETOF jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_paquete RECORD;
  v_precio numeric;
  v_ya_agregado boolean;
BEGIN
  FOR v_paquete IN
    SELECT * FROM public.paquetes
    WHERE hotel_id = p_hotel_id AND activo = true
    ORDER BY orden, nombre
  LOOP
    v_precio := 0;
    v_ya_agregado := false;

    IF p_reserva_id IS NOT NULL THEN
      v_precio := public.calculate_package_price(v_paquete.id, p_reserva_id);

      SELECT EXISTS (
        SELECT 1 FROM public.reserva_paquetes
        WHERE reserva_id = p_reserva_id AND paquete_id = v_paquete.id
      ) INTO v_ya_agregado;
    ELSE
      -- Precio de referencia (solo para fijo/por_noche)
      IF v_paquete.precio_tipo IN ('fijo', 'por_noche') THEN
        v_precio := v_paquete.precio_valor;
      END IF;
    END IF;

    RETURN NEXT jsonb_build_object(
      'paquete_id', v_paquete.id,
      'nombre', v_paquete.nombre,
      'descripcion', v_paquete.descripcion,
      'tipo', v_paquete.tipo,
      'precio_tipo', v_paquete.precio_tipo,
      'precio_valor', v_paquete.precio_valor,
      'precio_calculado', v_precio,
      'moneda', v_paquete.moneda,
      'requiere_confirmacion', v_paquete.requiere_confirmacion,
      'imagen_url', v_paquete.imagen_url,
      'ya_agregado', v_ya_agregado
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_packages_for_reservation TO authenticated, anon;

-- ============================================================================
-- RPC para JcarAI: sugerir upsells
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_suggest_upsells(
  p_reserva_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'paquete_id', p.id,
    'nombre', p.nombre,
    'descripcion', p.descripcion,
    'tipo', p.tipo,
    'precio_calculado', public.calculate_package_price(p.id, p_reserva_id),
    'moneda', p.moneda,
    'imagen_url', p.imagen_url
  )) INTO v_result
  FROM public.paquetes p
  WHERE p.hotel_id = (SELECT hotel_id FROM public.reservas WHERE id = p_reserva_id)
    AND p.activo = true
    AND p.id NOT IN (SELECT paquete_id FROM public.reserva_paquetes WHERE reserva_id = p_reserva_id)
    AND (
      p.tipo != 'traslado' OR (SELECT fecha_entrada FROM public.reservas WHERE id = p_reserva_id) > CURRENT_DATE + INTERVAL '1 day'
    )
    AND (
      p.tipo != 'late_checkout' OR (SELECT fecha_salida FROM public.reservas WHERE id = p_reserva_id) > CURRENT_DATE
    );

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ai_suggest_upsells TO authenticated;

-- ============================================================================
-- Extender create_reservation_atomic para incluir paquetes
-- ============================================================================

-- Nota: La función create_reservation_atomic ya existe en migración anterior.
-- Se extenderá en migración separada para no romper compatibilidad.
-- Aquí documentamos la intención: añadir parámetro p_paquetes_ids jsonb[]

COMMENT ON MIGRATION IS 'Paquetes/Add-ons: CRUD paquetes, reserva_paquetes, pricing dinámico, JcarAI upsells, anon access para booking público';