-- Optimizacion de procesos asincronos en Base de Datos (RPCs)

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_hotel_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    
    v_hoy date := current_date;
    v_inicio_mes date := date_trunc('month', current_date)::date;
BEGIN
    -- Habitaciones
    SELECT count(*), 
           sum(case when estado = 'ocupada' then 1 else 0 end),
           sum(case when estado = 'mantenimiento' then 1 else 0 end),
           sum(case when estado = 'limpieza' then 1 else 0 end),
           sum(case when estado = 'disponible' then 1 else 0 end)
    INTO v_habitaciones_total, v_ocupadas, v_mantenimiento, v_limpieza, v_libres
    FROM habitaciones
    WHERE hotel_id = p_hotel_id;

    -- Reservas
    SELECT sum(case when estado = 'activa' then 1 else 0 end),
           sum(case when estado in ('activa', 'pendiente') then 1 else 0 end)
    INTO v_reservas_activas, v_ocupadas_y_pendientes
    FROM reservas
    WHERE hotel_id = p_hotel_id;

    -- Ingresos Hoy Hotel
    SELECT coalesce(sum(total), 0)
    INTO v_ingresos_hoy_hotel
    FROM ventas
    WHERE hotel_id = p_hotel_id 
      AND (coalesce(fecha_pago::date, created_date::date) = v_hoy);

    -- Ingresos Hoy POS
    SELECT coalesce(sum(total), 0)
    INTO v_ingresos_hoy_pos
    FROM ventas_pos
    WHERE hotel_id = p_hotel_id 
      AND (coalesce(fecha_venta::date, created_date::date) = v_hoy);

    -- Acumulado Mes
    SELECT 
        (SELECT coalesce(sum(total), 0) FROM ventas WHERE hotel_id = p_hotel_id AND coalesce(fecha_pago::date, created_date::date) >= v_inicio_mes) +
        (SELECT coalesce(sum(total), 0) FROM ventas_pos WHERE hotel_id = p_hotel_id AND coalesce(fecha_venta::date, created_date::date) >= v_inicio_mes)
    INTO v_acumulado_mes;

    -- Tickets POS mes
    SELECT count(*)
    INTO v_tickets_pos
    FROM ventas_pos
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
$$;
