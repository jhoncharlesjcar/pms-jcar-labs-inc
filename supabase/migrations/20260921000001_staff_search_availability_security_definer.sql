-- staff_search_availability is SECURITY INVOKER and calls ai_search_availability_v2,
-- which authenticated cannot EXECUTE → PostgREST 403 and empty rooms in Recepción.
-- Keep v2 locked to service_role; elevate the staff wrapper (already checks role + hotel).

ALTER FUNCTION public.staff_search_availability(uuid, date, date, integer, integer)
  SECURITY DEFINER;

ALTER FUNCTION public.staff_search_availability(uuid, date, date, integer, integer)
  SET search_path TO pg_catalog, public;

REVOKE ALL ON FUNCTION public.staff_search_availability(uuid, date, date, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_search_availability(uuid, date, date, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_search_availability(uuid, date, date, integer, integer) TO service_role;
