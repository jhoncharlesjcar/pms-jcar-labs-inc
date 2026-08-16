-- User status and non-recursive authorization helpers.
-- These helpers must exist before the 20260814 RLS migrations.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_usuarios_activo
  ON public.usuarios (activo) WHERE activo = true;

CREATE OR REPLACE FUNCTION public.get_user_hotel_id(p_user_id uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.hotel_id FROM public.usuarios AS u WHERE u.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT u.role FROM public.usuarios AS u WHERE u.id = p_user_id AND u.activo IS TRUE;
$$;

CREATE OR REPLACE FUNCTION public.is_user_active(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((SELECT u.activo FROM public.usuarios AS u WHERE u.id = p_user_id), false);
$$;

REVOKE ALL ON FUNCTION public.get_user_hotel_id(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_hotel_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "admin_ver_usuarios_hotel" ON public.usuarios;
DROP POLICY IF EXISTS "admin_actualizar_usuarios" ON public.usuarios;

CREATE POLICY "Usuarios ven su propio perfil" ON public.usuarios
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admin_ver_usuarios_hotel" ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

CREATE POLICY "admin_actualizar_usuarios" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  )
  WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
