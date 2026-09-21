REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO service_role;
