-- ============================================================
-- P1 FIX: Atomic Reservations & Overlap Prevention
-- 1. Adds btree_gist and exclusion constraint for overlapping stays (pendiente, confirmada, activa)
-- 2. Creates RPC create_reservation_atomic and update_reservation_status_atomic
-- Path: supabase/migrations/20260818000002_atomic_reservation.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. Exclusion constraint to mathematically prevent double bookings on the same room
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reservas'::regclass
      AND conname = 'uq_reservas_sin_solapamiento'
  ) THEN
    ALTER TABLE public.reservas
      ADD CONSTRAINT uq_reservas_sin_solapamiento
      EXCLUDE USING gist (
        hotel_id WITH =,
        habitacion_id WITH =,
        daterange(fecha_entrada, fecha_salida, '[)') WITH &&
      )
      WHERE (estado IN ('pendiente', 'confirmada', 'activa') AND habitacion_id IS NOT NULL);
  END IF;
END $$;

-- 2. RPC: Atomic Reservation Creation + Room State Transition
CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_hotel_id uuid,
  p_habitacion_id uuid,
  p_habitacion_numero text,
  p_habitacion_tipo text,
  p_huesped_nombre text,
  p_huesped_dni text,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_noches integer,
  p_precio_noche numeric,
  p_total numeric,
  p_estado text DEFAULT 'pendiente',
  p_huesped_telefono text DEFAULT NULL,
  p_huesped_email text DEFAULT NULL,
  p_huesped_sexo text DEFAULT NULL,
  p_huesped_fecha_nacimiento date DEFAULT NULL,
  p_huesped_procedencia text DEFAULT NULL,
  p_huesped_destino text DEFAULT NULL,
  p_huesped_profesion text DEFAULT NULL,
  p_huesped_estado_civil text DEFAULT NULL,
  p_nacionalidad text DEFAULT NULL,
  p_motivo_viaje text DEFAULT NULL,
  p_tipo_documento text DEFAULT 'DNI',
  p_tiene_menores boolean DEFAULT false,
  p_observaciones text DEFAULT NULL,
  p_origen text DEFAULT 'recepcion',
  p_servicios_extra_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS public.reservas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_hab public.habitaciones%ROWTYPE;
  v_role text := public.get_user_role();
  v_user_hotel uuid := public.get_user_hotel_id();
  v_next_room_status text;
  v_numero_reserva text;
BEGIN
  -- Authorization check
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF v_role <> 'developer' AND p_hotel_id <> v_user_hotel THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  IF p_fecha_salida <= p_fecha_entrada THEN
    RAISE EXCEPTION 'check-out date must be after check-in date';
  END IF;

  IF p_estado NOT IN ('pendiente', 'confirmada', 'activa') THEN
    RAISE EXCEPTION 'invalid reservation initial state: %', p_estado;
  END IF;

  -- Lock room row for atomic check
  IF p_habitacion_id IS NOT NULL THEN
    SELECT * INTO v_hab
    FROM public.habitaciones
    WHERE id = p_habitacion_id AND hotel_id = p_hotel_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'room not found or does not belong to this hotel';
    END IF;

    -- Check if room is in maintenance
    IF v_hab.estado = 'mantenimiento' THEN
      RAISE EXCEPTION 'cannot book room currently in maintenance';
    END IF;
  END IF;

  v_numero_reserva := 'R' || substr(extract(epoch from now())::bigint::text, -6);

  -- Insert reservation
  INSERT INTO public.reservas (
    hotel_id, habitacion_id, habitacion_numero, habitacion_tipo,
    numero_reserva, estado, huesped_nombre, huesped_dni,
    huesped_telefono, huesped_email, huesped_sexo, huesped_fecha_nacimiento,
    huesped_procedencia, huesped_destino, huesped_profesion, huesped_estado_civil,
    nacionalidad, motivo_viaje, tipo_documento, tiene_menores,
    fecha_entrada, fecha_salida, noches, precio_noche, total,
    observaciones, origen, servicios_extra_ids
  ) VALUES (
    p_hotel_id, p_habitacion_id, p_habitacion_numero, p_habitacion_tipo,
    v_numero_reserva, p_estado, p_huesped_nombre, p_huesped_dni,
    p_huesped_telefono, p_huesped_email, p_huesped_sexo, p_huesped_fecha_nacimiento,
    p_huesped_procedencia, p_huesped_destino, p_huesped_profesion, p_huesped_estado_civil,
    p_nacionalidad, p_motivo_viaje, p_tipo_documento, p_tiene_menores,
    p_fecha_entrada, p_fecha_salida, p_noches, p_precio_noche, p_total,
    p_observaciones, p_origen, p_servicios_extra_ids
  )
  RETURNING * INTO v_reserva;

  -- Update room status atomically
  IF p_habitacion_id IS NOT NULL THEN
    v_next_room_status := CASE
      WHEN p_estado = 'activa' THEN 'ocupada'
      ELSE 'reservada'
    END;

    UPDATE public.habitaciones
    SET estado = v_next_room_status
    WHERE id = p_habitacion_id;
  END IF;

  RETURN v_reserva;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic TO authenticated;

-- 3. RPC: Atomic Reservation State Transition
CREATE OR REPLACE FUNCTION public.update_reservation_status_atomic(
  p_reserva_id uuid,
  p_nuevo_estado text,
  p_next_room_status text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_role text := public.get_user_role();
  v_user_hotel uuid := public.get_user_hotel_id();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO v_reserva
  FROM public.reservas
  WHERE id = p_reserva_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation not found';
  END IF;

  IF v_role <> 'developer' AND v_reserva.hotel_id <> v_user_hotel THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  -- Update reservation status
  UPDATE public.reservas
  SET estado = p_nuevo_estado
  WHERE id = p_reserva_id;

  -- Update room status if habitacion_id and target room status are provided
  IF v_reserva.habitacion_id IS NOT NULL AND p_next_room_status IS NOT NULL THEN
    UPDATE public.habitaciones
    SET estado = p_next_room_status
    WHERE id = v_reserva.habitacion_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.update_reservation_status_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_atomic TO authenticated;

NOTIFY pgrst, 'reload schema';
