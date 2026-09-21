-- Helpers de RLS no deben consultar public.hoteles como SECURITY INVOKER:
-- las policies de hoteles llaman a estas funciones, que hacían JOIN a hoteles,
-- lo que re-disparaba RLS → "stack depth limit exceeded" (HTTP 500 en PostgREST).

CREATE OR REPLACE FUNCTION public.get_user_hotel_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT u.hotel_id
  FROM public.usuarios AS u
  LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
  WHERE u.id = p_user_id
    AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE);
$function$;

CREATE OR REPLACE FUNCTION public.get_user_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT public.get_user_hotel_id(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT u.role
  FROM public.usuarios AS u
  LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
  WHERE u.id = p_user_id
    AND u.activo IS TRUE
    AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE);
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT public.get_user_role(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT COALESCE((
    SELECT (u.activo IS TRUE AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE))
    FROM public.usuarios AS u
    LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
    WHERE u.id = p_user_id
  ), false);
$function$;

CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
SET row_security TO 'off'
AS $function$
  SELECT public.is_user_active(auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.get_user_hotel_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_hotel_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_active(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_hotel_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hotel_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated;
