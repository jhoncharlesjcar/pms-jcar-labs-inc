-- ============================================================
-- MIGRACIÓN JCAR AI SALES AGENT — PMS JCAR LABS
-- Crea las funciones RPC para las operaciones atómicas del agente
-- Path: supabase/migrations/20260822000002_ai_agent_rpcs.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. AI CHECK AVAILABILITY
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ai_check_availability(
    p_hotel_id UUID,
    p_fecha_entrada DATE,
    p_fecha_salida DATE,
    p_adultos INTEGER DEFAULT 2,
    p_ninos INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_total_personas INTEGER := p_adultos + p_ninos;
    v_noches INTEGER;
    v_rooms_json JSONB;
BEGIN
    -- Validaciones básicas
    IF p_fecha_salida <= p_fecha_entrada THEN
        RAISE EXCEPTION 'La fecha de salida debe ser posterior a la fecha de entrada';
    END IF;

    v_noches := (p_fecha_salida - p_fecha_entrada);

    -- Buscar habitaciones disponibles
    -- Subquery para encontrar las que NO están reservadas en esas fechas (usando la lógica de la constraint &&)
    WITH HabitacionesDisponibles AS (
        SELECT h.id, h.numero, h.tipo, h.capacidad, h.precio_noche, h.amenidades
        FROM public.habitaciones h
        WHERE h.hotel_id = p_hotel_id
          AND h.estado != 'mantenimiento'
          AND h.capacidad >= v_total_personas
          AND NOT EXISTS (
              SELECT 1 FROM public.reservas r
              WHERE r.habitacion_id = h.id
                AND r.estado IN ('pendiente', 'confirmada', 'activa')
                AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
          )
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'room_type', hd.tipo,
            'habitacion_id', hd.id,
            'numero', hd.numero,
            'capacidad', hd.capacidad,
            'precio_noche', hd.precio_noche,
            'noches', v_noches,
            'total', hd.precio_noche * v_noches, -- TODO: integrar con tarifas dinámicas si aplica
            'currency', 'PEN',
            'amenidades', hd.amenidades
        )
    ), '[]'::jsonb) INTO v_rooms_json
    FROM HabitacionesDisponibles hd;

    RETURN jsonb_build_object(
        'available', jsonb_array_length(v_rooms_json) > 0,
        'rooms', v_rooms_json,
        'dates', jsonb_build_object(
            'check_in', p_fecha_entrada,
            'check_out', p_fecha_salida,
            'nights', v_noches
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_check_availability FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_check_availability TO authenticated, anon;


-- ────────────────────────────────────────────────────────────────
-- 2. AI CREATE GUEST AND RESERVATION
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ai_create_guest_and_reservation(
    p_hotel_id UUID,
    p_conversation_id UUID,
    p_guest_name TEXT,
    p_guest_phone TEXT,
    p_guest_email TEXT,
    p_habitacion_id UUID,
    p_fecha_entrada DATE,
    p_fecha_salida DATE,
    p_precio_noche NUMERIC,
    p_total NUMERIC,
    p_adultos INTEGER DEFAULT 2,
    p_ninos INTEGER DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    v_reserva public.reservas%ROWTYPE;
    v_hab public.habitaciones%ROWTYPE;
    v_numero_reserva TEXT;
    v_noches INTEGER;
BEGIN
    IF p_fecha_salida <= p_fecha_entrada THEN
        RAISE EXCEPTION 'check-out date must be after check-in date';
    END IF;
    
    v_noches := (p_fecha_salida - p_fecha_entrada);

    -- Bloquear habitación para verificar disponibilidad
    SELECT * INTO v_hab
    FROM public.habitaciones
    WHERE id = p_habitacion_id AND hotel_id = p_hotel_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Habitación no encontrada';
    END IF;

    -- Verificar solapamiento de fechas atómicamente
    IF EXISTS (
        SELECT 1 FROM public.reservas r
        WHERE r.habitacion_id = p_habitacion_id
          AND r.estado IN ('pendiente', 'confirmada', 'activa')
          AND daterange(r.fecha_entrada, r.fecha_salida, '[)') && daterange(p_fecha_entrada, p_fecha_salida, '[)')
    ) THEN
        RAISE EXCEPTION 'La habitación ya no está disponible para estas fechas';
    END IF;

    -- Generar número de reserva (AI + timestamp o similar)
    v_numero_reserva := 'AI' || substr(extract(epoch from now())::bigint::text, -6);

    -- Insertar reserva
    INSERT INTO public.reservas (
        hotel_id, habitacion_id, habitacion_numero, habitacion_tipo,
        numero_reserva, estado, huesped_nombre, huesped_telefono, huesped_email,
        fecha_entrada, fecha_salida, noches, precio_noche, total,
        num_adultos, num_ninos, origen, observaciones
    ) VALUES (
        p_hotel_id, p_habitacion_id, v_hab.numero, v_hab.tipo,
        v_numero_reserva, 'pendiente', p_guest_name, p_guest_phone, p_guest_email,
        p_fecha_entrada, p_fecha_salida, v_noches, p_precio_noche, p_total,
        p_adultos, p_ninos, 'ai_web', 'Reserva generada por JCAR AI Agent'
    )
    RETURNING * INTO v_reserva;

    -- Actualizar habitación a reservada
    UPDATE public.habitaciones
    SET estado = 'reservada'
    WHERE id = p_habitacion_id;

    -- Actualizar conversación AI
    UPDATE public.ai_conversations
    SET status = 'booked',
        reserva_id = v_reserva.id,
        guest_name = COALESCE(guest_name, p_guest_name),
        guest_phone = COALESCE(guest_phone, p_guest_phone),
        guest_email = COALESCE(guest_email, p_guest_email)
    WHERE id = p_conversation_id AND hotel_id = p_hotel_id;

    RETURN jsonb_build_object(
        'success', true,
        'reserva_id', v_reserva.id,
        'numero_reserva', v_reserva.numero_reserva,
        'habitacion_numero', v_reserva.habitacion_numero,
        'fecha_entrada', v_reserva.fecha_entrada,
        'fecha_salida', v_reserva.fecha_salida,
        'total', v_reserva.total
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ai_create_guest_and_reservation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ai_create_guest_and_reservation TO authenticated, anon;

NOTIFY pgrst, 'reload schema';
