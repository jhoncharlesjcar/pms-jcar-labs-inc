-- Availability compared check-in against cluster current_date (UTC).
-- After 19:00 Lima that day is already "tomorrow" in us-west-1, so a same-day
-- stay raised 'invalid stay date range' and the form showed no rooms.

CREATE OR REPLACE FUNCTION public.hotel_today_lima()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (timezone('America/Lima', now()))::date;
$$;

REVOKE ALL ON FUNCTION public.hotel_today_lima() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hotel_today_lima() TO authenticated, service_role;

DO $$
DECLARE
  def text;
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ai_search_availability_v2', 'ai_calculate_room_quote')
      AND pg_get_functiondef(p.oid) LIKE '%p_fecha_entrada < current_date%'
  LOOP
    def := replace(
      pg_get_functiondef(fn.oid),
      'p_fecha_entrada < current_date',
      'p_fecha_entrada < public.hotel_today_lima()'
    );
    EXECUTE def;
  END LOOP;
END $$;
