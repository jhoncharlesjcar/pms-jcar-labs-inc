-- ============================================================
-- P1 FIX: Enforce Hotel Active Status in Security Helpers
-- Suspended hotels (activo = false) must immediately lose operational access.
-- Path: supabase/migrations/20260818000005_enforce_hotel_activo.sql
-- ============================================================

-- 1. Helper to check if a hotel is active
CREATE OR REPLACE FUNCTION public.is_hotel_active(p_hotel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT h.activo
    FROM public.hoteles h
    WHERE h.id = p_hotel_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.is_hotel_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_hotel_active(public.get_user_hotel_id());
$$;

-- 2. Enhanced get_user_hotel_id: returns NULL if hotel is deactivated (unless developer)
CREATE OR REPLACE FUNCTION public.get_user_hotel_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.hotel_id
  FROM public.usuarios AS u
  LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
  WHERE u.id = p_user_id
    AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE);
$$;

CREATE OR REPLACE FUNCTION public.get_user_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.get_user_hotel_id(auth.uid());
$$;

-- 3. Enhanced is_user_active: ensures both user and their assigned hotel are active
CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((
    SELECT (u.activo IS TRUE AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE))
    FROM public.usuarios AS u
    LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
    WHERE u.id = p_user_id
  ), false);
$$;

CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.is_user_active(auth.uid());
$$;

-- 4. Enhanced get_user_role: returns NULL if user or tenant is deactivated
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.role
  FROM public.usuarios AS u
  LEFT JOIN public.hoteles AS h ON h.id = u.hotel_id
  WHERE u.id = p_user_id
    AND u.activo IS TRUE
    AND (u.role = 'developer' OR u.hotel_id IS NULL OR h.activo IS TRUE);
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.get_user_role(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_hotel_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_hotel_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_hotel_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_hotel_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_active(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_hotel_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_hotel_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_hotel_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_hotel_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
