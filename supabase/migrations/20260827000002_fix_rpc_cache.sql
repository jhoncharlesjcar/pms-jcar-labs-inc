-- Este script fuerza la recompilación de la función y limpia la caché de PostgREST
-- para evitar el error 500 "structure of query does not match function result type"
-- provocado al añadir la columna imagen_url a la tabla habitaciones.

CREATE OR REPLACE FUNCTION public.ai_calculate_room_quote(
  p_hotel_id uuid,
  p_habitacion_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_room public.habitaciones%ROWTYPE;
  v_day date;
  v_factor numeric;
  v_rate numeric;
  v_total numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_total_rooms integer;
  v_occupied integer;
  v_occupancy integer;
BEGIN
  IF p_fecha_entrada < current_date OR p_fecha_salida <= p_fecha_entrada
     OR p_fecha_salida - p_fecha_entrada > 30 THEN
    RAISE EXCEPTION 'invalid stay date range';
  END IF;

  SELECT * INTO v_room FROM public.habitaciones
  WHERE id = p_habitacion_id AND hotel_id = p_hotel_id AND estado <> 'mantenimiento';
  IF NOT FOUND THEN RAISE EXCEPTION 'room is not available for quoting'; END IF;

  SELECT count(*) INTO v_total_rooms FROM public.habitaciones
  WHERE hotel_id = p_hotel_id AND estado <> 'mantenimiento';

  FOR v_day IN SELECT generate_series(p_fecha_entrada, p_fecha_salida - 1, interval '1 day')::date LOOP
    SELECT count(DISTINCT r.habitacion_id) INTO v_occupied
    FROM public.reservas r
    WHERE r.hotel_id = p_hotel_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(v_day, v_day + 1, '[)');
    v_occupancy := CASE WHEN v_total_rooms = 0 THEN 0 ELSE round((v_occupied::numeric / v_total_rooms) * 100) END;

    SELECT COALESCE(max(t.factor_ajuste), 1) INTO v_factor
    FROM public.tarifas_dinamicas t
    WHERE t.hotel_id = p_hotel_id AND t.activo = true
      AND COALESCE(t.habitacion_tipo, 'todos') IN ('todos', v_room.tipo)
      AND (
        (t.tipo = 'temporada' AND v_day BETWEEN t.fecha_inicio::date AND t.fecha_fin::date)
        OR (t.tipo = 'dia_semana' AND extract(dow from v_day)::integer = ANY(t.dias_semana))
        OR (t.tipo = 'ocupacion' AND v_occupancy >= COALESCE(t.umbral_ocupacion_min, 101))
      );

    v_rate := round(v_room.precio_noche * v_factor, 2);
    v_total := v_total + v_rate;
    v_breakdown := v_breakdown || jsonb_build_array(jsonb_build_object(
      'date', v_day, 'base_rate', v_room.precio_noche, 'factor', v_factor,
      'nightly_rate', v_rate, 'occupancy_percent', v_occupancy
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'habitacion_id', v_room.id, 'room_number', v_room.numero, 'room_type', v_room.tipo,
    'description', v_room.descripcion, 'amenities', '[]'::jsonb,
    'capacity', v_room.capacidad, 'nights', p_fecha_salida - p_fecha_entrada,
    'nightly_rate', round(v_total / (p_fecha_salida - p_fecha_entrada), 2),
    'total', round(v_total, 2), 'currency', 'PEN', 'breakdown', v_breakdown
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
