-- ============================================================
-- P1 FIX: Atomic POS Sale Creation and Stock Deduction
-- Creates create_pos_sale_atomic RPC with row-level locking (FOR UPDATE)
-- to prevent overselling and race conditions.
-- Path: supabase/migrations/20260818000003_atomic_pos_sale.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_pos_sale_atomic(
  p_hotel_id uuid,
  p_items jsonb,
  p_tipo text,
  p_habitacion_numero text,
  p_huesped_nombre text,
  p_huesped_dni text,
  p_reserva_id uuid,
  p_subtotal_estadia numeric,
  p_subtotal_extras numeric,
  p_descuento numeric,
  p_total numeric,
  p_metodo_pago text,
  p_estado_comprobante text,
  p_tipo_comprobante text,
  p_ruc_cliente text DEFAULT '',
  p_razon_social text DEFAULT '',
  p_notas text DEFAULT ''
)
RETURNS public.ventas_pos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_item jsonb;
  v_item_id uuid;
  v_item_qty integer;
  v_prod public.productos%ROWTYPE;
  v_reserva public.reservas%ROWTYPE;
  v_venta public.ventas_pos%ROWTYPE;
  v_numero_ticket text;
  v_role text := public.get_user_role();
  v_user_hotel uuid := public.get_user_hotel_id();
BEGIN
  -- Authorization check
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_role <> 'developer' AND p_hotel_id <> v_user_hotel THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  -- 1. Validate & deduct stock atomically with FOR UPDATE locks
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
      IF (v_item->>'id') IS NOT NULL AND (v_item->>'id') <> '' THEN
        v_item_id := (v_item->>'id')::uuid;
        v_item_qty := COALESCE((v_item->>'cantidad')::integer, 1);

        SELECT * INTO v_prod
        FROM public.productos
        WHERE id = v_item_id AND hotel_id = p_hotel_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'product with id % not found in this hotel', v_item_id;
        END IF;

        IF v_prod.stock < v_item_qty THEN
          RAISE EXCEPTION 'insufficient stock for product "%": requested %, available %',
            v_prod.nombre, v_item_qty, v_prod.stock;
        END IF;

        UPDATE public.productos
        SET stock = stock - v_item_qty
        WHERE id = v_item_id;
      END IF;
    END LOOP;
  END IF;

  -- 2. If attached to active reservation, update reservation and room atomically
  IF p_reserva_id IS NOT NULL THEN
    SELECT * INTO v_reserva
    FROM public.reservas
    WHERE id = p_reserva_id AND hotel_id = p_hotel_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.reservas
      SET estado = 'finalizada'
      WHERE id = p_reserva_id;

      IF v_reserva.habitacion_id IS NOT NULL THEN
        UPDATE public.habitaciones
        SET estado = 'limpieza'
        WHERE id = v_reserva.habitacion_id;
      END IF;
    END IF;
  END IF;

  -- 3. Generate unique ticket number
  v_numero_ticket := 'POS' || substr(extract(epoch from now())::bigint::text, -6);

  -- 4. Create the POS sale record
  INSERT INTO public.ventas_pos (
    hotel_id, numero_ticket, tipo, habitacion_numero,
    huesped_nombre, huesped_dni, reserva_id, items,
    subtotal_estadia, subtotal_extras, descuento, total,
    metodo_pago, estado_comprobante, tipo_comprobante,
    ruc_cliente, razon_social, notas, fecha_venta
  ) VALUES (
    p_hotel_id, v_numero_ticket, p_tipo, p_habitacion_numero,
    p_huesped_nombre, p_huesped_dni, p_reserva_id, p_items,
    p_subtotal_estadia, p_subtotal_extras, p_descuento, p_total,
    p_metodo_pago, p_estado_comprobante, p_tipo_comprobante,
    p_ruc_cliente, p_razon_social, p_notas, now()
  )
  RETURNING * INTO v_venta;

  RETURN v_venta;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_sale_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_sale_atomic TO authenticated;

NOTIFY pgrst, 'reload schema';
