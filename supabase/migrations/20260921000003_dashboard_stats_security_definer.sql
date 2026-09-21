-- Dashboard stats must not re-enter RLS; use Lima civil day for "hoy".
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_hotel_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO pg_catalog, public
AS $function$
DECLARE
    v_habitaciones_total int;
    v_ocupadas int;
    v_mantenimiento int;
    v_limpieza int;
    v_libres int;
    v_reservas_activas int;
    v_ocupadas_y_pendientes int;
    v_ingresos_hoy_hotel numeric := 0;
    v_ingresos_hoy_pos numeric := 0;
    v_acumulado_mes numeric := 0;
    v_tickets_pos int := 0;
    v_hoy date := (timezone('America/Lima', now()))::date;
    v_inicio_mes date := date_trunc('month', timezone('America/Lima', now()))::date;
    v_role text := public.get_user_role();
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_user_active()
       OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
        RAISE EXCEPTION 'not authorized';
    END IF;
    IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
        RAISE EXCEPTION 'hotel mismatch';
    END IF;

    SELECT count(*),
           coalesce(sum(case when estado = 'ocupada' then 1 else 0 end), 0),
           coalesce(sum(case when estado = 'mantenimiento' then 1 else 0 end), 0),
           coalesce(sum(case when estado = 'limpieza' then 1 else 0 end), 0),
           coalesce(sum(case when estado = 'disponible' then 1 else 0 end), 0)
    INTO v_habitaciones_total, v_ocupadas, v_mantenimiento, v_limpieza, v_libres
    FROM public.habitaciones
    WHERE hotel_id = p_hotel_id;

    SELECT coalesce(sum(case when estado = 'activa' then 1 else 0 end), 0),
           coalesce(sum(case when estado in ('activa', 'pendiente') then 1 else 0 end), 0)
    INTO v_reservas_activas, v_ocupadas_y_pendientes
    FROM public.reservas
    WHERE hotel_id = p_hotel_id;

    SELECT coalesce(sum(total), 0)
    INTO v_ingresos_hoy_hotel
    FROM public.ventas
    WHERE hotel_id = p_hotel_id
      AND (coalesce(fecha_pago::date, created_date::date) = v_hoy);

    SELECT coalesce(sum(total), 0)
    INTO v_ingresos_hoy_pos
    FROM public.ventas_pos
    WHERE hotel_id = p_hotel_id
      AND (coalesce(fecha_venta::date, created_date::date) = v_hoy);

    SELECT
        (SELECT coalesce(sum(total), 0) FROM public.ventas WHERE hotel_id = p_hotel_id AND coalesce(fecha_pago::date, created_date::date) >= v_inicio_mes) +
        (SELECT coalesce(sum(total), 0) FROM public.ventas_pos WHERE hotel_id = p_hotel_id AND coalesce(fecha_venta::date, created_date::date) >= v_inicio_mes)
    INTO v_acumulado_mes;

    SELECT count(*)
    INTO v_tickets_pos
    FROM public.ventas_pos
    WHERE hotel_id = p_hotel_id
      AND coalesce(fecha_venta::date, created_date::date) >= v_inicio_mes;

    RETURN json_build_object(
        'libres', coalesce(v_libres, 0),
        'ocupadas', coalesce(v_ocupadas, 0),
        'mantenimiento', coalesce(v_mantenimiento, 0),
        'limpieza', coalesce(v_limpieza, 0),
        'habitaciones_total', coalesce(v_habitaciones_total, 0),
        'reservas_activas', coalesce(v_reservas_activas, 0),
        'ocupadas_y_pendientes', coalesce(v_ocupadas_y_pendientes, 0),
        'ingresos_hospedaje_hoy', v_ingresos_hoy_hotel,
        'ingresos_pos_hoy', v_ingresos_hoy_pos,
        'ingresos_hoy', v_ingresos_hoy_hotel + v_ingresos_hoy_pos,
        'acumulado_mes', v_acumulado_mes,
        'tickets_pos', coalesce(v_tickets_pos, 0),
        'ocupacion_pct', CASE WHEN v_habitaciones_total > 0 THEN round(((coalesce(v_ocupadas,0) + coalesce(v_limpieza,0))::numeric / v_habitaciones_total::numeric) * 100) ELSE 0 END
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO service_role;
