-- ============================================================
-- P1 FIX: Public Booking Rate Limiting & Stale Booking Expiration
-- Path: supabase/migrations/20260818000004_booking_rate_limit.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.booking_rate_limits (
  ip_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_rate_limits FROM anon, authenticated;

-- Atomic rate limit checking RPC
CREATE OR REPLACE FUNCTION public.check_booking_rate_limit(
  p_ip_hash text,
  p_max_attempts integer DEFAULT 10,
  p_window_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rec public.booking_rate_limits%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  IF p_ip_hash IS NULL OR length(p_ip_hash) < 16 THEN
    RETURN false;
  END IF;

  SELECT * INTO v_rec
  FROM public.booking_rate_limits
  WHERE ip_hash = p_ip_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.booking_rate_limits (ip_hash, attempts, window_start)
    VALUES (p_ip_hash, 1, v_now);
    RETURN true;
  END IF;

  -- Window expired: reset window
  IF v_now - v_rec.window_start > (p_window_seconds || ' seconds')::interval THEN
    UPDATE public.booking_rate_limits
    SET attempts = 1, window_start = v_now
    WHERE ip_hash = p_ip_hash;
    RETURN true;
  END IF;

  -- Exceeded rate limit
  IF v_rec.attempts >= p_max_attempts THEN
    RETURN false;
  END IF;

  -- Increment attempt counter
  UPDATE public.booking_rate_limits
  SET attempts = attempts + 1
  WHERE ip_hash = p_ip_hash;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.check_booking_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_booking_rate_limit(text, integer, integer) TO service_role;

-- Function to clean up stale pending online bookings (> 24 hours without confirmation)
CREATE OR REPLACE FUNCTION public.expire_stale_public_bookings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;

  WITH expired AS (
    UPDATE public.reservas
    SET estado = 'cancelada',
        observaciones = COALESCE(observaciones || ' | ', '') || '[AUTO-CANCELADA POR EXPIRACION 24H]'
    WHERE estado = 'pendiente'
      AND origen = 'booking_engine'
      AND created_date < now() - INTERVAL '24 hours'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_stale_public_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_public_bookings() TO service_role;

NOTIFY pgrst, 'reload schema';
