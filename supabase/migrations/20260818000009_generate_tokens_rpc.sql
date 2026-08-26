-- Migration to create the checkin and portal tokens from the backend

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_reservation_tokens(p_reserva_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_role text := public.get_user_role();
  v_user_hotel uuid := public.get_user_hotel_id();
  
  v_portal_token text;
  v_checkin_token text;
  v_portal_hash text;
  v_checkin_hash text;
  v_expires_at timestamptz;
BEGIN
  -- Authorization check
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Verify reservation
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reservation not found';
  END IF;

  IF v_role <> 'developer' AND v_reserva.hotel_id <> v_user_hotel THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  -- Generate tokens (matching Deno implementation)
  v_portal_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_checkin_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  
  v_portal_hash := encode(digest(v_portal_token, 'sha256'), 'hex');
  v_checkin_hash := encode(digest(v_checkin_token, 'sha256'), 'hex');
  
  v_expires_at := v_reserva.fecha_salida + interval '1 day';

  DELETE FROM public.guest_access_tokens WHERE reservation_id = p_reserva_id;

  INSERT INTO public.guest_access_tokens (reservation_id, token_hash, scope, expires_at)
  VALUES 
    (p_reserva_id, v_portal_hash, 'portal', v_expires_at),
    (p_reserva_id, v_checkin_hash, 'checkin', v_expires_at);

  RETURN jsonb_build_object(
    'portal_token', v_portal_token,
    'checkin_token', v_checkin_token
  );
END;
$$;

REVOKE ALL ON FUNCTION public.generate_reservation_tokens FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_reservation_tokens TO authenticated;
