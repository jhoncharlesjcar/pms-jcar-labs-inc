-- Restore scoped write policies for hotel management.
-- The active-user hardening migration recreated hoteles_tenant_isolation as
-- SELECT-only, unintentionally blocking create/update/delete from the UI.

DROP POLICY IF EXISTS "hoteles_insert_developer" ON public.hoteles;
CREATE POLICY "hoteles_insert_developer" ON public.hoteles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );

DROP POLICY IF EXISTS "hoteles_update_admin_developer" ON public.hoteles;
CREATE POLICY "hoteles_update_admin_developer" ON public.hoteles
  FOR UPDATE TO authenticated
  USING (
    public.is_user_active()
    AND (
      public.get_user_role() = 'developer'
      OR (
        public.get_user_role() = 'admin'
        AND id = public.get_user_hotel_id()
      )
    )
  )
  WITH CHECK (
    public.is_user_active()
    AND (
      public.get_user_role() = 'developer'
      OR (
        public.get_user_role() = 'admin'
        AND id = public.get_user_hotel_id()
      )
    )
  );

DROP POLICY IF EXISTS "hoteles_delete_developer" ON public.hoteles;
CREATE POLICY "hoteles_delete_developer" ON public.hoteles
  FOR DELETE TO authenticated
  USING (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );
