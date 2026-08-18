-- ============================================================
-- P1 FIX: Granular RLS Policies for Operational Tables
-- Replaces overly permissive "FOR ALL" policies on reservas, ventas,
-- ventas_pos, and servicios_extra with separate SELECT, INSERT, UPDATE, DELETE.
-- Path: supabase/migrations/20260818000006_granular_rls.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. RESERVAS
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "reservas_tenant_isolation" ON public.reservas;
DROP POLICY IF EXISTS "reservas_select" ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert" ON public.reservas;
DROP POLICY IF EXISTS "reservas_update" ON public.reservas;
DROP POLICY IF EXISTS "reservas_delete" ON public.reservas;

CREATE POLICY "reservas_select" ON public.reservas
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "reservas_insert" ON public.reservas
  FOR INSERT TO authenticated WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "reservas_update" ON public.reservas
  FOR UPDATE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "reservas_delete" ON public.reservas
  FOR DELETE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );

-- ────────────────────────────────────────────────────────────────
-- 2. VENTAS (Hotel)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ventas_tenant_isolation" ON public.ventas;
DROP POLICY IF EXISTS "ventas_select" ON public.ventas;
DROP POLICY IF EXISTS "ventas_insert" ON public.ventas;
DROP POLICY IF EXISTS "ventas_update" ON public.ventas;
DROP POLICY IF EXISTS "ventas_delete" ON public.ventas;

CREATE POLICY "ventas_select" ON public.ventas
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_insert" ON public.ventas
  FOR INSERT TO authenticated WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_update" ON public.ventas
  FOR UPDATE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_delete" ON public.ventas
  FOR DELETE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );

-- ────────────────────────────────────────────────────────────────
-- 3. VENTAS POS (Minimarket)
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ventas_pos_tenant_isolation" ON public.ventas_pos;
DROP POLICY IF EXISTS "ventas_pos_select" ON public.ventas_pos;
DROP POLICY IF EXISTS "ventas_pos_insert" ON public.ventas_pos;
DROP POLICY IF EXISTS "ventas_pos_update" ON public.ventas_pos;
DROP POLICY IF EXISTS "ventas_pos_delete" ON public.ventas_pos;

CREATE POLICY "ventas_pos_select" ON public.ventas_pos
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_pos_insert" ON public.ventas_pos
  FOR INSERT TO authenticated WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_pos_update" ON public.ventas_pos
  FOR UPDATE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "ventas_pos_delete" ON public.ventas_pos
  FOR DELETE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );

-- ────────────────────────────────────────────────────────────────
-- 4. SERVICIOS EXTRA
-- ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "servicios_extra_tenant_isolation" ON public.servicios_extra;
DROP POLICY IF EXISTS "servicios_extra_select" ON public.servicios_extra;
DROP POLICY IF EXISTS "servicios_extra_insert" ON public.servicios_extra;
DROP POLICY IF EXISTS "servicios_extra_update" ON public.servicios_extra;
DROP POLICY IF EXISTS "servicios_extra_delete" ON public.servicios_extra;

CREATE POLICY "servicios_extra_select" ON public.servicios_extra
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "servicios_extra_insert" ON public.servicios_extra
  FOR INSERT TO authenticated WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "servicios_extra_update" ON public.servicios_extra
  FOR UPDATE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  ) WITH CHECK (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "servicios_extra_delete" ON public.servicios_extra
  FOR DELETE TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() = 'developer'
  );

NOTIFY pgrst, 'reload schema';
