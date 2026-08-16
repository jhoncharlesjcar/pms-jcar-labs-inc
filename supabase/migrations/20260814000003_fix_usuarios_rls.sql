-- User RLS hardening, protected columns, safe signup, and payment persistence.

DROP POLICY IF EXISTS "usuarios_update_own" ON public.usuarios;
DROP POLICY IF EXISTS "admin_actualizar_usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_update_own_profile" ON public.usuarios;
DROP POLICY IF EXISTS "admin_update_hotel_users" ON public.usuarios;
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON public.usuarios;
DROP POLICY IF EXISTS "usuarios_select_own" ON public.usuarios;
DROP POLICY IF EXISTS "admin_ver_usuarios_hotel" ON public.usuarios;
DROP POLICY IF EXISTS "admin_select_hotel_users" ON public.usuarios;

CREATE OR REPLACE FUNCTION public.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text := public.get_user_role();
  v_hotel uuid := public.get_user_hotel_id();
BEGIN
  IF auth.uid() = OLD.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role OR NEW.hotel_id IS DISTINCT FROM OLD.hotel_id
       OR NEW.activo IS DISTINCT FROM OLD.activo THEN
      RAISE EXCEPTION 'protected user fields cannot be changed by their owner';
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    IF v_role NOT IN ('admin', 'developer') THEN
      RAISE EXCEPTION 'administrator role required';
    END IF;
    IF v_role = 'admin' AND (
      OLD.hotel_id IS DISTINCT FROM v_hotel OR NEW.hotel_id IS DISTINCT FROM v_hotel
      OR NEW.role = 'developer'
    ) THEN
      RAISE EXCEPTION 'admin cannot cross tenant or grant developer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.usuarios;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_escalation();

CREATE POLICY "usuarios_select_own" ON public.usuarios
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "admin_select_hotel_users" ON public.usuarios
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
CREATE POLICY "usuarios_update_own_profile" ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_user_active())
  WITH CHECK (id = auth.uid());
CREATE POLICY "admin_update_hotel_users" ON public.usuarios
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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- Public signup never selects a tenant or privilege. Membership is assigned later
  -- by a trusted invitation/Admin API workflow.
  INSERT INTO public.usuarios(id, email, full_name, role, hotel_id, activo)
  VALUES (
    NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'recepcionista', NULL, false
  );
  RETURN NEW;
END;
$$;

ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS payment_intent_id uuid,
  ADD COLUMN IF NOT EXISTS payment_provider text,
  ADD COLUMN IF NOT EXISTS payment_currency text,
  ADD COLUMN IF NOT EXISTS payment_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS webhook_event_id text,
  ADD COLUMN IF NOT EXISTS webhook_processed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_payment_intent
  ON public.reservas(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reservas_webhook_event
  ON public.reservas(webhook_event_id) WHERE webhook_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.confirm_reservation_payment(
  p_payment_intent_id uuid,
  p_event_id text,
  p_amount numeric,
  p_currency text,
  p_provider text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_event_id IS NULL OR btrim(p_event_id) = '' THEN RAISE EXCEPTION 'event_id required'; END IF;
  UPDATE public.reservas
  SET estado_pago = 'pagado', webhook_event_id = p_event_id, webhook_processed_at = now()
  WHERE payment_intent_id = p_payment_intent_id
    AND payment_provider = p_provider
    AND payment_currency = upper(p_currency)
    AND payment_amount = p_amount
    AND estado_pago = 'pendiente'
    AND NOT EXISTS (SELECT 1 FROM public.reservas r2 WHERE r2.webhook_event_id = p_event_id)
  RETURNING id INTO v_reserva_id;
  IF v_reserva_id IS NULL THEN RAISE EXCEPTION 'payment confirmation did not match a pending order'; END IF;
  RETURN v_reserva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_role_escalation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_reservation_payment(uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_reservation_payment(uuid, text, numeric, text, text) TO service_role;
