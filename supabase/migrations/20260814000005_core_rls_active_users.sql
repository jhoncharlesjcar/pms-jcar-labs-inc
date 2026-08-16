-- Apply active-user, non-recursive tenant checks to the core and OTA policies.

DROP POLICY IF EXISTS "hoteles_tenant_isolation" ON public.hoteles;
CREATE POLICY "hoteles_tenant_isolation" ON public.hoteles
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "habitaciones_tenant_isolation" ON public.habitaciones;
CREATE POLICY "habitaciones_select_staff" ON public.habitaciones
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
CREATE POLICY "habitaciones_insert_admin" ON public.habitaciones
  FOR INSERT TO authenticated WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
CREATE POLICY "habitaciones_update_operations" ON public.habitaciones
  FOR UPDATE TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'limpieza', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
CREATE POLICY "habitaciones_delete_admin" ON public.habitaciones
  FOR DELETE TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE OR REPLACE FUNCTION public.limit_housekeeping_room_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF public.get_user_role() = 'limpieza' THEN
    IF (to_jsonb(NEW) - 'estado' - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'estado' - 'updated_at')
       OR NEW.estado NOT IN ('limpieza', 'disponible') THEN
      RAISE EXCEPTION 'housekeeping may only update operational room status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_limit_housekeeping_room_updates ON public.habitaciones;
CREATE TRIGGER trg_limit_housekeeping_room_updates BEFORE UPDATE ON public.habitaciones
  FOR EACH ROW EXECUTE FUNCTION public.limit_housekeeping_room_updates();
REVOKE ALL ON FUNCTION public.limit_housekeeping_room_updates() FROM PUBLIC;

DROP POLICY IF EXISTS "reservas_tenant_isolation" ON public.reservas;
CREATE POLICY "reservas_tenant_isolation" ON public.reservas
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "ventas_tenant_isolation" ON public.ventas;
CREATE POLICY "ventas_tenant_isolation" ON public.ventas
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "servicios_extra_tenant_isolation" ON public.servicios_extra;
CREATE POLICY "servicios_extra_tenant_isolation" ON public.servicios_extra
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "ventas_pos_tenant_isolation" ON public.ventas_pos;
CREATE POLICY "ventas_pos_tenant_isolation" ON public.ventas_pos
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "Permitir lectura ota_config solo para staff" ON public.ota_config;
DROP POLICY IF EXISTS "Permitir mutaciones ota_config para staff" ON public.ota_config;
CREATE POLICY "ota_config_admin_select" ON public.ota_config
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
CREATE POLICY "ota_config_admin_mutate" ON public.ota_config
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

DROP POLICY IF EXISTS "Permitir lectura ota_room_mappings solo para staff" ON public.ota_room_mappings;
DROP POLICY IF EXISTS "Permitir mutaciones ota_room_mappings para staff" ON public.ota_room_mappings;
CREATE POLICY "ota_room_mappings_admin" ON public.ota_room_mappings
  FOR ALL TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );
