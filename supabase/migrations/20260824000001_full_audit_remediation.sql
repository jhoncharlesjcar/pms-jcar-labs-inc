-- ============================================================
-- FULL AUDIT REMEDIATION
-- Additive hardening after 20260823000001.
-- All monetary, inventory, identity and delivery transitions are server-side.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- --------------------------------------------------------------------------
-- 1. Shared validation and immutable audit ledger
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_guest_document(p_type text, p_document text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE upper(btrim(COALESCE(p_type, '')))
    WHEN 'DNI' THEN btrim(COALESCE(p_document, '')) ~ '^[0-9]{8}$'
    WHEN 'RUC' THEN btrim(COALESCE(p_document, '')) ~ '^[0-9]{11}$'
    WHEN 'CE' THEN btrim(COALESCE(p_document, '')) ~ '^[A-Za-z0-9-]{4,20}$'
    WHEN 'PASAPORTE' THEN btrim(COALESCE(p_document, '')) ~ '^[A-Za-z0-9-]{4,20}$'
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.validate_guest_document(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_guest_document(text, text) TO authenticated, service_role;

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE RESTRICT,
  actor_id uuid,
  actor_role text NOT NULL,
  action text NOT NULL,
  module text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id text,
  previous_hash text,
  event_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_audit_events_hotel_created
  ON public.audit_events(hotel_id, created_at DESC);
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_events_admin_read ON public.audit_events
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

REVOKE ALL ON public.audit_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'append-only relation cannot be updated or deleted';
END;
$$;

CREATE TRIGGER trg_audit_events_append_only
  BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
DROP POLICY IF EXISTS audit_logs_admin_read ON public.audit_logs;
CREATE POLICY audit_logs_admin_read ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
GRANT SELECT ON public.audit_logs TO authenticated;

CREATE OR REPLACE FUNCTION public._append_audit_event(
  p_hotel_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_action text,
  p_module text,
  p_entity_type text,
  p_entity_id text,
  p_description text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_request_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_previous_hash text;
  v_created_at timestamptz := clock_timestamp();
  v_hash text;
BEGIN
  IF p_hotel_id IS NULL OR length(btrim(COALESCE(p_action, ''))) < 2
     OR length(btrim(COALESCE(p_module, ''))) < 2 THEN
    RAISE EXCEPTION 'invalid audit event';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_hotel_id::text || ':audit', 0));
  SELECT event_hash INTO v_previous_hash
  FROM public.audit_events
  WHERE hotel_id = p_hotel_id
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  v_hash := encode(digest(
    COALESCE(v_previous_hash, '') || '|' || v_id::text || '|' || p_hotel_id::text || '|' ||
    COALESCE(p_actor_id::text, '') || '|' || COALESCE(p_actor_role, '') || '|' ||
    p_action || '|' || p_module || '|' || COALESCE(p_entity_type, '') || '|' ||
    COALESCE(p_entity_id, '') || '|' || COALESCE(p_description, '') || '|' ||
    COALESCE(p_metadata, '{}'::jsonb)::text || '|' || v_created_at::text,
    'sha256'
  ), 'hex');

  INSERT INTO public.audit_events(
    id, hotel_id, actor_id, actor_role, action, module, entity_type, entity_id,
    description, metadata, request_id, previous_hash, event_hash, created_at
  ) VALUES (
    v_id, p_hotel_id, p_actor_id, COALESCE(p_actor_role, 'system'), btrim(p_action),
    btrim(p_module), p_entity_type, p_entity_id, p_description,
    COALESCE(p_metadata, '{}'::jsonb), p_request_id, v_previous_hash, v_hash, v_created_at
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._append_audit_event(uuid,uuid,text,text,text,text,text,text,jsonb,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_hotel_id uuid,
  p_action text,
  p_module text,
  p_entity_type text DEFAULT NULL,
  p_entity_id text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_request_id text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  RETURN public._append_audit_event(
    p_hotel_id, auth.uid(), v_role, p_action, p_module, p_entity_type, p_entity_id,
    p_description, p_metadata, p_request_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit_event(uuid,text,text,text,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.write_audit_event(uuid,text,text,text,text,text,jsonb,text) TO authenticated;

-- --------------------------------------------------------------------------
-- 2. Cross-tenant relational invariants
-- --------------------------------------------------------------------------

ALTER TABLE public.reservas ADD CONSTRAINT uq_reservas_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_conversations ADD CONSTRAINT uq_ai_conversations_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_booking_intents ADD CONSTRAINT uq_ai_booking_intents_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_quotes ADD CONSTRAINT uq_ai_quotes_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT uq_ai_holds_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT uq_ai_payment_intents_id_hotel UNIQUE (id, hotel_id);

ALTER TABLE public.ai_messages ADD CONSTRAINT fk_ai_messages_conversation_hotel
  FOREIGN KEY (conversation_id, hotel_id)
  REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_booking_intents ADD CONSTRAINT fk_ai_intents_conversation_hotel
  FOREIGN KEY (conversation_id, hotel_id)
  REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_booking_intents ADD CONSTRAINT fk_ai_intents_room_hotel
  FOREIGN KEY (selected_room_id, hotel_id)
  REFERENCES public.habitaciones(id, hotel_id);
ALTER TABLE public.ai_quotes ADD CONSTRAINT fk_ai_quotes_conversation_hotel
  FOREIGN KEY (conversation_id, hotel_id)
  REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_quotes ADD CONSTRAINT fk_ai_quotes_intent_hotel
  FOREIGN KEY (booking_intent_id, hotel_id)
  REFERENCES public.ai_booking_intents(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_quotes ADD CONSTRAINT fk_ai_quotes_room_hotel
  FOREIGN KEY (habitacion_id, hotel_id)
  REFERENCES public.habitaciones(id, hotel_id);
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT fk_ai_holds_conversation_hotel
  FOREIGN KEY (conversation_id, hotel_id)
  REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT fk_ai_holds_intent_hotel
  FOREIGN KEY (booking_intent_id, hotel_id)
  REFERENCES public.ai_booking_intents(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT fk_ai_holds_quote_hotel
  FOREIGN KEY (quote_id, hotel_id)
  REFERENCES public.ai_quotes(id, hotel_id) ON DELETE RESTRICT;
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT fk_ai_holds_room_hotel
  FOREIGN KEY (habitacion_id, hotel_id)
  REFERENCES public.habitaciones(id, hotel_id) ON DELETE RESTRICT;
ALTER TABLE public.ai_reservation_holds ADD CONSTRAINT fk_ai_holds_reservation_hotel
  FOREIGN KEY (reservation_id, hotel_id)
  REFERENCES public.reservas(id, hotel_id);
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT fk_ai_payments_conversation_hotel
  FOREIGN KEY (conversation_id, hotel_id)
  REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT fk_ai_payments_intent_hotel
  FOREIGN KEY (booking_intent_id, hotel_id)
  REFERENCES public.ai_booking_intents(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT fk_ai_payments_hold_hotel
  FOREIGN KEY (hold_id, hotel_id)
  REFERENCES public.ai_reservation_holds(id, hotel_id) ON DELETE RESTRICT;
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT fk_ai_payments_quote_hotel
  FOREIGN KEY (quote_id, hotel_id)
  REFERENCES public.ai_quotes(id, hotel_id) ON DELETE RESTRICT;
ALTER TABLE public.ai_payment_intents ADD CONSTRAINT fk_ai_payments_reservation_hotel
  FOREIGN KEY (reservation_id, hotel_id)
  REFERENCES public.reservas(id, hotel_id);
ALTER TABLE public.ai_payment_events ADD CONSTRAINT fk_ai_payment_events_intent_hotel
  FOREIGN KEY (payment_intent_id, hotel_id)
  REFERENCES public.ai_payment_intents(id, hotel_id) ON DELETE CASCADE;
ALTER TABLE public.ai_conversations ADD CONSTRAINT fk_ai_conversations_reservation_hotel
  FOREIGN KEY (reserva_id, hotel_id)
  REFERENCES public.reservas(id, hotel_id);

-- --------------------------------------------------------------------------
-- 3. Checkout: one sale per reservation, atomic and idempotent
-- --------------------------------------------------------------------------

CREATE TABLE public.checkout_duplicate_sales (
  duplicate_sale_id uuid PRIMARY KEY REFERENCES public.ventas(id) ON DELETE RESTRICT,
  canonical_sale_id uuid NOT NULL REFERENCES public.ventas(id) ON DELETE RESTRICT,
  reservation_id uuid NOT NULL REFERENCES public.reservas(id) ON DELETE RESTRICT,
  detected_at timestamptz NOT NULL DEFAULT now()
);

WITH ranked AS (
  SELECT id, reserva_id,
    first_value(id) OVER (PARTITION BY reserva_id ORDER BY created_date, id) AS canonical_id,
    row_number() OVER (PARTITION BY reserva_id ORDER BY created_date, id) AS rn
  FROM public.ventas
  WHERE reserva_id IS NOT NULL
), archived AS (
  INSERT INTO public.checkout_duplicate_sales(duplicate_sale_id, canonical_sale_id, reservation_id)
  SELECT id, canonical_id, reserva_id FROM ranked WHERE rn > 1
  ON CONFLICT (duplicate_sale_id) DO NOTHING
  RETURNING duplicate_sale_id
)
UPDATE public.ventas v SET reserva_id = NULL
WHERE v.id IN (SELECT duplicate_sale_id FROM archived);

CREATE UNIQUE INDEX uq_ventas_reserva
  ON public.ventas(reserva_id) WHERE reserva_id IS NOT NULL;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS checkout_idempotency_key text,
  ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX uq_ventas_checkout_idempotency
  ON public.ventas(hotel_id, checkout_idempotency_key)
  WHERE checkout_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.refresh_room_operational_status(p_room_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_current text;
  v_next text;
BEGIN
  SELECT estado INTO v_current FROM public.habitaciones WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_current = 'mantenimiento' THEN RETURN v_current; END IF;

  v_next := CASE
    WHEN EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.habitacion_id = p_room_id AND r.estado = 'activa'
    ) THEN 'ocupada'
    WHEN EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.habitacion_id = p_room_id AND r.estado IN ('pendiente', 'confirmada')
        AND r.fecha_salida >= CURRENT_DATE
    ) THEN 'reservada'
    ELSE 'disponible'
  END;
  UPDATE public.habitaciones SET estado = v_next WHERE id = p_room_id;
  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_room_operational_status(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.checkout_reserva_atomic(
  p_reserva_id uuid,
  p_hotel_id uuid,
  p_user_id uuid,
  p_venta jsonb,
  p_loyalty jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_venta public.ventas%ROWTYPE;
  v_role text := public.get_user_role();
  v_subtotal numeric(12,2);
  v_discount numeric(12,2);
  v_total numeric(12,2);
  v_method text;
  v_type text;
  v_receipt_state text;
  v_key text;
  v_reference text;
  v_account public.loyalty_accounts%ROWTYPE;
  v_blocks integer := GREATEST(COALESCE((p_loyalty->>'blocks')::integer, 1), 1);
  v_redeem boolean := COALESCE((p_loyalty->>'redeem')::boolean, false);
  v_earn boolean := COALESCE((p_loyalty->>'earn')::boolean, true);
  v_points integer;
  v_max_loyalty_discount numeric(12,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'actor mismatch'; END IF;
  IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_reserva_id::text || ':checkout', 0));
  SELECT * INTO v_reserva FROM public.reservas
  WHERE id = p_reserva_id AND hotel_id = p_hotel_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;

  SELECT * INTO v_venta FROM public.ventas WHERE reserva_id = p_reserva_id;
  IF FOUND THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'venta', to_jsonb(v_venta));
  END IF;
  IF v_reserva.estado <> 'activa' THEN RAISE EXCEPTION 'only an active stay can be checked out'; END IF;

  v_method := lower(btrim(COALESCE(p_venta->>'metodo_pago', '')));
  IF v_method NOT IN ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta') THEN
    RAISE EXCEPTION 'unsupported payment method';
  END IF;
  v_reference := btrim(COALESCE(p_venta->>'codigo_referencia', p_venta->>'payment_reference', ''));
  IF v_method IN ('yape', 'plin') AND length(v_reference) < 3 THEN
    RAISE EXCEPTION 'payment reference is required';
  END IF;

  v_subtotal := round(GREATEST(COALESCE(v_reserva.total, v_reserva.precio_noche * v_reserva.noches, 0), 0), 2);
  v_discount := round(GREATEST(COALESCE((p_venta->>'descuento')::numeric, 0), 0), 2);

  IF v_redeem THEN
    IF v_reserva.habitacion_tipo IS NULL OR
       lower(v_reserva.habitacion_tipo) !~ '(simple|sencilla|individual)' THEN
      RAISE EXCEPTION 'loyalty redemption only applies to simple rooms';
    END IF;
    SELECT * INTO v_account FROM public.loyalty_accounts
    WHERE hotel_id = p_hotel_id
      AND guest_document_type = COALESCE(v_reserva.tipo_documento, 'DNI')
      AND guest_document_number = btrim(COALESCE(v_reserva.huesped_dni, ''))
    FOR UPDATE;
    v_points := 100 * v_blocks;
    IF NOT FOUND OR v_account.points_balance < v_points THEN
      RAISE EXCEPTION 'insufficient loyalty balance';
    END IF;
    v_max_loyalty_discount := round(LEAST(v_subtotal, COALESCE(v_reserva.precio_noche, 0) * v_reserva.noches * 0.50 * v_blocks), 2);
    IF abs(v_discount - v_max_loyalty_discount) > 0.01 THEN
      RAISE EXCEPTION 'discount does not match server loyalty calculation';
    END IF;
    UPDATE public.loyalty_accounts SET points_balance = points_balance - v_points, updated_at = now()
    WHERE id = v_account.id;
    INSERT INTO public.loyalty_transactions(
      operation_id, loyalty_account_id, hotel_id, type, points, reference_type,
      reference_id, created_by
    ) VALUES (
      gen_random_uuid(), v_account.id, p_hotel_id, 'redeemed', -v_points,
      'redemption', p_reserva_id, auth.uid()
    );
  ELSE
    IF v_discount > 0 AND v_role = 'recepcionista' THEN
      IF v_discount > round(v_subtotal * COALESCE((SELECT max_discount_percent FROM public.ai_hotel_config WHERE hotel_id = p_hotel_id), 0) / 100, 2) THEN
        RAISE EXCEPTION 'discount exceeds configured authorization';
      END IF;
    END IF;
  END IF;

  IF v_discount > v_subtotal THEN RAISE EXCEPTION 'discount exceeds subtotal'; END IF;
  v_total := round(v_subtotal - v_discount, 2);
  IF (p_venta ? 'total') AND abs((p_venta->>'total')::numeric - v_total) > 0.01 THEN
    RAISE EXCEPTION 'client total does not match server total';
  END IF;

  v_type := lower(COALESCE(NULLIF(p_venta->>'tipo_comprobante', ''), 'ninguno'));
  IF v_type NOT IN ('ninguno', 'boleta', 'factura') THEN RAISE EXCEPTION 'invalid receipt type'; END IF;
  IF v_type = 'factura' AND (
    COALESCE(p_venta->>'ruc_cliente', '') !~ '^[0-9]{11}$'
    OR length(btrim(COALESCE(p_venta->>'razon_social', ''))) < 3
  ) THEN RAISE EXCEPTION 'valid RUC and legal name are required'; END IF;
  v_receipt_state := CASE WHEN v_type = 'ninguno' THEN 'ticket_interno' ELSE 'sunat_pendiente' END;
  v_key := NULLIF(btrim(COALESCE(p_venta->>'idempotency_key', '')), '');
  IF v_key IS NULL THEN v_key := 'checkout:' || p_reserva_id::text; END IF;

  INSERT INTO public.ventas(
    hotel_id, numero_ticket, reserva_id, numero_reserva, habitacion_numero,
    habitacion_tipo, huesped_nombre, huesped_dni, fecha_entrada, fecha_salida,
    noches, precio_noche, subtotal, descuento, total, metodo_pago,
    estado_comprobante, tipo_comprobante, ruc_cliente, razon_social, notas,
    fecha_pago, checkout_idempotency_key, processed_by
  ) VALUES (
    p_hotel_id, 'T-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_reserva.id, v_reserva.numero_reserva, v_reserva.habitacion_numero,
    v_reserva.habitacion_tipo,
    CASE WHEN v_type = 'factura' THEN btrim(p_venta->>'razon_social')
      ELSE COALESCE(NULLIF(btrim(p_venta->>'nombre_cliente'), ''), v_reserva.huesped_nombre) END,
    CASE WHEN v_type = 'factura' THEN btrim(p_venta->>'ruc_cliente')
      ELSE COALESCE(NULLIF(btrim(p_venta->>'dni_cliente'), ''), v_reserva.huesped_dni) END,
    v_reserva.fecha_entrada::text, v_reserva.fecha_salida::text, v_reserva.noches,
    v_reserva.precio_noche, v_subtotal, v_discount, v_total, v_method,
    v_receipt_state, v_type, NULLIF(btrim(p_venta->>'ruc_cliente'), ''),
    NULLIF(btrim(p_venta->>'razon_social'), ''),
    concat_ws(' ', NULLIF(btrim(p_venta->>'notas'), ''),
      CASE WHEN v_reference <> '' THEN '[Ref ' || upper(v_method) || ': ' || v_reference || ']' END),
    CURRENT_DATE::text, v_key, auth.uid()
  ) RETURNING * INTO v_venta;

  UPDATE public.reservas SET estado = 'finalizada', estado_pago = 'pagado'
  WHERE id = v_reserva.id;
  IF v_reserva.habitacion_id IS NOT NULL THEN
    UPDATE public.habitaciones SET estado = 'limpieza' WHERE id = v_reserva.habitacion_id;
  END IF;

  IF v_earn AND COALESCE(btrim(v_reserva.huesped_dni), '') <> '' THEN
    SELECT * INTO v_account FROM public.loyalty_accounts
    WHERE hotel_id = p_hotel_id
      AND guest_document_type = COALESCE(v_reserva.tipo_documento, 'DNI')
      AND guest_document_number = btrim(v_reserva.huesped_dni)
    FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO public.loyalty_accounts(
        hotel_id, guest_document_type, guest_document_number, guest_name
      ) VALUES (
        p_hotel_id, COALESCE(v_reserva.tipo_documento, 'DNI'),
        btrim(v_reserva.huesped_dni), v_reserva.huesped_nombre
      ) RETURNING * INTO v_account;
    END IF;
    v_points := GREATEST(v_reserva.noches, 0) * 10;
    IF v_points > 0 THEN
      UPDATE public.loyalty_accounts SET points_balance = points_balance + v_points,
        last_stay_date = CURRENT_DATE, updated_at = now() WHERE id = v_account.id;
      INSERT INTO public.loyalty_transactions(
        operation_id, loyalty_account_id, hotel_id, type, points, reference_type,
        reference_id, nights_count, created_by
      ) VALUES (
        gen_random_uuid(), v_account.id, p_hotel_id, 'earned', v_points,
        'checkout', p_reserva_id, v_reserva.noches, auth.uid()
      );
    END IF;
  END IF;

  PERFORM public._append_audit_event(
    p_hotel_id, auth.uid(), v_role, 'CHECKOUT_COMPLETED', 'recepcion',
    'reserva', p_reserva_id::text,
    format('Checkout %s por S/ %s', COALESCE(v_reserva.numero_reserva, p_reserva_id::text), v_total),
    jsonb_build_object('sale_id', v_venta.id, 'payment_method', v_method,
      'subtotal', v_subtotal, 'discount', v_discount, 'total', v_total), v_key
  );

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'venta', to_jsonb(v_venta));
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_reserva_atomic(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_reserva_atomic(uuid,uuid,uuid,jsonb,jsonb) TO authenticated;

-- --------------------------------------------------------------------------
-- 4. Paid-late reconciliation and a transactional public booking checkout
-- --------------------------------------------------------------------------

ALTER TABLE public.ai_payment_intents
  DROP CONSTRAINT IF EXISTS ai_payment_intents_status_check;
ALTER TABLE public.ai_payment_intents
  ADD CONSTRAINT ai_payment_intents_status_check CHECK (status IN (
    'created', 'pending', 'awaiting_manual_review', 'paid',
    'paid_needs_reconciliation', 'failed', 'expired', 'cancelled',
    'refund_pending', 'refunded'
  ));

ALTER TABLE public.ai_payment_intents
  ADD COLUMN IF NOT EXISTS client_idempotency_key text,
  ADD COLUMN IF NOT EXISTS reconciliation_reason text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid REFERENCES auth.users(id);

CREATE UNIQUE INDEX uq_ai_payment_client_idempotency
  ON public.ai_payment_intents(hotel_id, client_idempotency_key)
  WHERE client_idempotency_key IS NOT NULL;

ALTER TABLE public.ai_reservation_holds
  DROP CONSTRAINT IF EXISTS ai_reservation_holds_status_check;
ALTER TABLE public.ai_reservation_holds
  ADD CONSTRAINT ai_reservation_holds_status_check CHECK (status IN (
    'active', 'payment_pending', 'converted', 'expired', 'cancelled', 'reconciliation'
  ));

ALTER TABLE public.ai_booking_intents
  DROP CONSTRAINT IF EXISTS ai_booking_intents_status_check;
ALTER TABLE public.ai_booking_intents
  ADD CONSTRAINT ai_booking_intents_status_check CHECK (status IN (
    'qualified', 'quote_created', 'quote_accepted', 'guest_data_pending',
    'hold_active', 'payment_pending', 'confirmed', 'reconciliation_required',
    'abandoned', 'cancelled'
  ));

ALTER TABLE public.ai_conversations
  DROP CONSTRAINT IF EXISTS ai_conversations_journey_stage_check;
ALTER TABLE public.ai_conversations
  ADD CONSTRAINT ai_conversations_journey_stage_check CHECK (journey_stage IN (
    'lead', 'qualified', 'availability_checked', 'quote_created', 'quote_accepted',
    'guest_data_pending', 'reservation_hold', 'payment_pending', 'payment_under_review',
    'payment_verified', 'payment_reconciliation', 'reservation_confirmed', 'pre_checkin',
    'arrival', 'stay', 'checkout', 'post_stay', 'rebooking', 'handed_off', 'closed'
  ));

CREATE TABLE public.ai_payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE RESTRICT,
  payment_intent_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'refund_pending', 'refunded')),
  resolution text,
  resolution_note text,
  alternate_room_id uuid,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_intent_id),
  CONSTRAINT fk_ai_reconciliation_payment_hotel
    FOREIGN KEY (payment_intent_id, hotel_id)
    REFERENCES public.ai_payment_intents(id, hotel_id) ON DELETE RESTRICT,
  CONSTRAINT fk_ai_reconciliation_room_hotel
    FOREIGN KEY (alternate_room_id, hotel_id)
    REFERENCES public.habitaciones(id, hotel_id)
);

CREATE TABLE public.ai_manual_payment_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE RESTRICT,
  payment_intent_id uuid NOT NULL,
  object_path text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[a-f0-9]{64}$'),
  observed_amount numeric(12,2) NOT NULL CHECK (observed_amount > 0),
  observed_at timestamptz NOT NULL,
  submitted_by text NOT NULL DEFAULT 'guest',
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ai_evidence_payment_hotel
    FOREIGN KEY (payment_intent_id, hotel_id)
    REFERENCES public.ai_payment_intents(id, hotel_id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_manual_evidence_payment
  ON public.ai_manual_payment_evidence(payment_intent_id, created_at DESC);

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ai_payment_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_manual_payment_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_payment_reconciliations_admin_read ON public.ai_payment_reconciliations
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
CREATE POLICY ai_manual_payment_evidence_verifier_read ON public.ai_manual_payment_evidence
  FOR SELECT TO authenticated USING (
    public.is_user_active()
    AND (
      public.get_user_role() IN ('admin', 'developer')
      OR (public.get_user_role() = 'recepcionista'
          AND COALESCE((SELECT permissions->>'verify_manual_payments'
            FROM public.usuarios WHERE id = auth.uid()), 'false')::boolean)
    )
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

REVOKE ALL ON public.ai_payment_reconciliations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ai_manual_payment_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ai_payment_reconciliations, public.ai_manual_payment_evidence TO authenticated;

CREATE OR REPLACE FUNCTION public._ai_mark_payment_reconciliation(
  p_payment_intent_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment intent not found'; END IF;

  UPDATE public.ai_payment_intents
  SET status = 'paid_needs_reconciliation', reconciliation_reason = left(p_reason, 1000),
      updated_at = now()
  WHERE id = v_payment.id;
  UPDATE public.ai_reservation_holds SET status = 'reconciliation', updated_at = now()
  WHERE id = v_payment.hold_id AND status <> 'converted';
  UPDATE public.ai_booking_intents SET status = 'reconciliation_required', updated_at = now()
  WHERE id = v_payment.booking_intent_id;
  UPDATE public.ai_conversations
  SET status = 'handed_off', journey_stage = 'payment_reconciliation',
      human_controlled = true, updated_at = now()
  WHERE id = v_payment.conversation_id;

  INSERT INTO public.ai_payment_reconciliations(
    hotel_id, payment_intent_id, reason
  ) VALUES (v_payment.hotel_id, v_payment.id, left(p_reason, 1000))
  ON CONFLICT (payment_intent_id) DO UPDATE
    SET reason = EXCLUDED.reason, updated_at = now(), status = 'open';

  INSERT INTO public.ai_domain_events(hotel_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (
    v_payment.hotel_id, 'payment_intent', v_payment.id,
    'payment.reconciliation_required',
    jsonb_build_object('payment_intent_id', v_payment.id,
      'conversation_id', v_payment.conversation_id, 'reason', left(p_reason, 1000))
  );
END;
$$;

REVOKE ALL ON FUNCTION public._ai_mark_payment_reconciliation(uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Replaces the old finalizer: a late/contended payment is persisted and routed
-- to reconciliation. Guest tokens are never created or placed in an event here.
CREATE OR REPLACE FUNCTION public.ai_finalize_paid_hold(p_payment_intent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_hold public.ai_reservation_holds%ROWTYPE;
  v_quote public.ai_quotes%ROWTYPE;
  v_room public.habitaciones%ROWTYPE;
  v_reservation public.reservas%ROWTYPE;
  v_confirmation_message_id uuid;
BEGIN
  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.status NOT IN ('paid', 'paid_needs_reconciliation') THEN
    RAISE EXCEPTION 'payment is not paid';
  END IF;
  IF v_payment.reservation_id IS NOT NULL THEN RETURN v_payment.reservation_id; END IF;
  IF v_payment.status = 'paid_needs_reconciliation' THEN RETURN NULL; END IF;

  SELECT * INTO v_hold FROM public.ai_reservation_holds
  WHERE id = v_payment.hold_id FOR UPDATE;
  IF NOT FOUND OR v_hold.status NOT IN ('active', 'payment_pending') OR v_hold.expires_at <= now() THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id, 'hold expired before payment confirmation');
    RETURN NULL;
  END IF;
  SELECT * INTO v_quote FROM public.ai_quotes WHERE id = v_hold.quote_id FOR UPDATE;
  SELECT * INTO v_room FROM public.habitaciones
  WHERE id = v_hold.habitacion_id AND hotel_id = v_hold.hotel_id FOR UPDATE;
  IF NOT FOUND OR v_room.estado = 'mantenimiento' THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id, 'room unavailable at payment confirmation');
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.hotel_id = v_hold.hotel_id AND r.habitacion_id = v_hold.habitacion_id
      AND r.estado IN ('pendiente', 'confirmada', 'activa')
      AND daterange(r.fecha_entrada, r.fecha_salida, '[)')
        && daterange(v_hold.fecha_entrada, v_hold.fecha_salida, '[)')
  ) THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id, 'inventory conflict after payment');
    RETURN NULL;
  END IF;

  BEGIN
    INSERT INTO public.reservas(
      hotel_id, habitacion_id, habitacion_numero, habitacion_tipo, numero_reserva,
      estado, huesped_nombre, huesped_dni, huesped_telefono, huesped_email,
      tipo_documento, fecha_entrada, fecha_salida, noches, precio_noche, total,
      origen, observaciones, estado_pago, payment_intent_id, payment_provider,
      payment_currency, payment_amount, ai_hold_id, num_adultos, num_ninos
    ) VALUES (
      v_hold.hotel_id, v_hold.habitacion_id, v_room.numero, v_room.tipo,
      'AI-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
      'confirmada', v_hold.guest_name, v_hold.guest_document, v_hold.guest_phone,
      v_hold.guest_email, v_hold.guest_document_type, v_hold.fecha_entrada,
      v_hold.fecha_salida, v_quote.noches, v_quote.precio_noche, v_quote.total,
      'jcar_ai', 'Reserva confirmada por pago verificado',
      CASE WHEN v_payment.amount >= v_quote.total THEN 'pagado' ELSE 'adelanto_pagado' END,
      v_payment.id, v_payment.provider, v_payment.currency, v_payment.amount,
      v_hold.id, v_quote.adultos, v_quote.ninos
    ) RETURNING * INTO v_reservation;
  EXCEPTION WHEN exclusion_violation OR unique_violation OR foreign_key_violation THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id,
      'inventory changed concurrently: ' || SQLERRM);
    RETURN NULL;
  END;

  UPDATE public.ai_reservation_holds
  SET status = 'converted', reservation_id = v_reservation.id, updated_at = now()
  WHERE id = v_hold.id;
  UPDATE public.ai_payment_intents
  SET reservation_id = v_reservation.id, reconciliation_reason = NULL, updated_at = now()
  WHERE id = v_payment.id;
  UPDATE public.ai_booking_intents SET status = 'confirmed', updated_at = now()
  WHERE id = v_hold.booking_intent_id;
  UPDATE public.ai_conversations
  SET status = 'booked', journey_stage = 'reservation_confirmed',
      reserva_id = v_reservation.id, human_controlled = false, updated_at = now()
  WHERE id = v_hold.conversation_id;
  UPDATE public.habitaciones SET estado = 'reservada' WHERE id = v_room.id;

  INSERT INTO public.ai_messages(
    conversation_id, hotel_id, role, content, direction, delivery_status
  ) VALUES (
    v_hold.conversation_id, v_hold.hotel_id, 'assistant',
    format('¡Listo! Tu reserva %s está confirmada para la habitación %s, del %s al %s. El pago fue verificado correctamente.',
      v_reservation.numero_reserva, v_reservation.habitacion_numero,
      to_char(v_reservation.fecha_entrada, 'DD/MM/YYYY'),
      to_char(v_reservation.fecha_salida, 'DD/MM/YYYY')),
    'outbound', 'queued'
  ) RETURNING id INTO v_confirmation_message_id;

  INSERT INTO public.ai_domain_events(hotel_id, aggregate_type, aggregate_id, event_type, payload)
  VALUES (
    v_hold.hotel_id, 'reservation', v_reservation.id, 'reservation.confirmed',
    jsonb_build_object('conversation_id', v_hold.conversation_id,
      'payment_intent_id', v_payment.id, 'reservation_number', v_reservation.numero_reserva,
      'message_id', v_confirmation_message_id, 'requires_token_delivery', true)
  );
  PERFORM public._append_audit_event(
    v_hold.hotel_id, NULL, 'service_role', 'RESERVATION_CONFIRMED', 'jcar_ai',
    'reserva', v_reservation.id::text, 'Reserva creada después de pago verificado',
    jsonb_build_object('payment_intent_id', v_payment.id), NULL
  );
  RETURN v_reservation.id;
END;
$$;

-- Remove raw credentials generated by the previous finalizer from pending/history.
UPDATE public.ai_domain_events
SET payload = payload - 'portal_token' - 'checkin_token'
WHERE payload ? 'portal_token' OR payload ? 'checkin_token';

CREATE OR REPLACE FUNCTION public.ai_process_payment_event(
  p_payment_intent_id uuid,
  p_event_id text,
  p_amount numeric,
  p_currency text,
  p_provider text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_existing public.ai_payment_events%ROWTYPE;
  v_reservation_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF length(btrim(COALESCE(p_event_id, ''))) < 3 THEN RAISE EXCEPTION 'event id required'; END IF;

  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment intent not found'; END IF;
  SELECT * INTO v_existing FROM public.ai_payment_events
  WHERE provider = p_provider AND provider_event_id = p_event_id;
  IF FOUND THEN
    IF v_existing.payment_intent_id <> p_payment_intent_id THEN
      RAISE EXCEPTION 'payment event already used';
    END IF;
    RETURN v_payment.reservation_id;
  END IF;

  IF v_payment.provider <> p_provider OR v_payment.currency <> upper(p_currency)
     OR v_payment.amount <> p_amount
     OR v_payment.status NOT IN ('created', 'pending', 'expired') THEN
    RAISE EXCEPTION 'payment event does not match payable intent';
  END IF;

  INSERT INTO public.ai_payment_events(
    hotel_id, payment_intent_id, provider, provider_event_id, event_type,
    amount, currency, payload
  ) VALUES (
    v_payment.hotel_id, v_payment.id, p_provider, p_event_id,
    CASE WHEN v_payment.status = 'expired' THEN 'payment.succeeded_late' ELSE 'payment.succeeded' END,
    p_amount, upper(p_currency), COALESCE(p_payload, '{}'::jsonb)
  );
  UPDATE public.ai_payment_intents
  SET status = 'paid', paid_at = now(), verified_at = now(), updated_at = now()
  WHERE id = v_payment.id;

  BEGIN
    v_reservation_id := public.ai_finalize_paid_hold(v_payment.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id,
      'finalization error: ' || SQLSTATE || ' ' || SQLERRM);
    v_reservation_id := NULL;
  END;
  RETURN v_reservation_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_public_booking_checkout(
  p_hotel_id uuid,
  p_session_id text,
  p_idempotency_key text,
  p_habitacion_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_adultos integer,
  p_ninos integer,
  p_guest_name text,
  p_guest_phone text,
  p_guest_document text,
  p_guest_email text DEFAULT NULL,
  p_guest_document_type text DEFAULT 'DNI',
  p_payment_method text DEFAULT 'yape'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conversation public.ai_conversations%ROWTYPE;
  v_existing public.ai_payment_intents%ROWTYPE;
  v_quote_result jsonb;
  v_hold_result jsonb;
  v_payment_result jsonb;
  v_quote jsonb;
  v_hold jsonb;
  v_payment jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF length(btrim(COALESCE(p_session_id, ''))) NOT BETWEEN 12 AND 200
     OR length(btrim(COALESCE(p_idempotency_key, ''))) NOT BETWEEN 12 AND 200 THEN
    RAISE EXCEPTION 'valid session and idempotency key required';
  END IF;
  IF p_fecha_entrada < CURRENT_DATE OR p_fecha_salida <= p_fecha_entrada
     OR p_fecha_salida - p_fecha_entrada > 30 THEN RAISE EXCEPTION 'invalid stay dates'; END IF;
  IF p_adultos NOT BETWEEN 1 AND 20 OR p_ninos NOT BETWEEN 0 AND 20 THEN
    RAISE EXCEPTION 'invalid occupancy';
  END IF;
  IF length(btrim(COALESCE(p_guest_name, ''))) NOT BETWEEN 3 AND 150
     OR length(btrim(COALESCE(p_guest_phone, ''))) NOT BETWEEN 6 AND 30
     OR NOT public.validate_guest_document(p_guest_document_type, p_guest_document) THEN
    RAISE EXCEPTION 'invalid guest data';
  END IF;
  IF p_guest_email IS NOT NULL AND btrim(p_guest_email) <> ''
     AND btrim(p_guest_email) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'invalid email';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_hotel_id::text || ':' || p_idempotency_key, 0));
  SELECT * INTO v_existing FROM public.ai_payment_intents
  WHERE hotel_id = p_hotel_id AND client_idempotency_key = p_idempotency_key;
  IF FOUND THEN
    SELECT to_jsonb(q) INTO v_quote FROM public.ai_quotes q WHERE id = v_existing.quote_id;
    SELECT to_jsonb(h) INTO v_hold FROM public.ai_reservation_holds h WHERE id = v_existing.hold_id;
    RETURN jsonb_build_object(
      'success', true, 'idempotent', true, 'conversation_id', v_existing.conversation_id,
      'quote', jsonb_build_object('id', v_existing.quote_id, 'number', v_quote->>'quote_number',
        'total', v_quote->'total', 'currency', v_quote->'currency'),
      'hold', jsonb_build_object('id', v_existing.hold_id, 'expires_at', v_hold->'expires_at'),
      'payment', jsonb_build_object('id', v_existing.id, 'status', v_existing.status,
        'provider', v_existing.provider, 'method', v_existing.method, 'amount', v_existing.amount,
        'currency', v_existing.currency, 'instructions', v_existing.instructions,
        'expires_at', v_existing.expires_at)
    );
  END IF;

  SELECT * INTO v_conversation FROM public.ai_conversations
  WHERE hotel_id = p_hotel_id AND channel = 'web' AND session_id = p_session_id
    AND status NOT IN ('closed', 'abandoned')
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.ai_conversations(hotel_id, channel, session_id, status, journey_stage)
    VALUES (p_hotel_id, 'web', p_session_id, 'active', 'lead')
    RETURNING * INTO v_conversation;
  END IF;

  v_quote_result := public.ai_create_verified_quote(
    p_hotel_id, v_conversation.id, p_habitacion_id, p_fecha_entrada,
    p_fecha_salida, p_adultos, p_ninos
  );
  v_quote := v_quote_result->'quote';
  v_hold_result := public.ai_accept_quote_and_create_hold(
    p_hotel_id, v_conversation.id, (v_quote->>'id')::uuid, p_guest_name,
    p_guest_phone, p_guest_document, p_guest_email, p_guest_document_type
  );
  v_hold := v_hold_result->'hold';
  v_payment_result := public.ai_create_payment_request(
    p_hotel_id, v_conversation.id, (v_hold->>'id')::uuid, p_payment_method
  );
  v_payment := v_payment_result->'payment';
  UPDATE public.ai_payment_intents SET client_idempotency_key = p_idempotency_key
  WHERE id = (v_payment->>'id')::uuid;

  RETURN jsonb_build_object(
    'success', true, 'idempotent', false, 'conversation_id', v_conversation.id,
    'quote', jsonb_build_object('id', v_quote->'id', 'number', v_quote->'quote_number',
      'total', v_quote->'total', 'currency', v_quote->'currency'),
    'hold', jsonb_build_object('id', v_hold->'id', 'expires_at', v_hold->'expires_at'),
    'payment', jsonb_build_object('id', v_payment->'id', 'status', v_payment->'status',
      'provider', v_payment->'provider', 'method', v_payment->'method',
      'amount', v_payment->'amount', 'currency', v_payment->'currency',
      'instructions', v_payment->'instructions', 'expires_at', v_payment->'expires_at')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking_checkout(
  uuid,text,text,uuid,date,date,integer,integer,text,text,text,text,text,text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_checkout(
  uuid,text,text,uuid,date,date,integer,integer,text,text,text,text,text,text
) TO service_role;

-- --------------------------------------------------------------------------
-- 5. Evidence-backed manual payment and explicit reconciliation
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_submit_manual_payment_evidence(
  p_payment_intent_id uuid,
  p_evidence jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_evidence_id uuid;
  v_path text := btrim(COALESCE(p_evidence->>'object_path', ''));
  v_hash text := lower(btrim(COALESCE(p_evidence->>'content_sha256', '')));
  v_amount numeric := COALESCE((p_evidence->>'observed_amount')::numeric, 0);
  v_observed_at timestamptz := COALESCE((p_evidence->>'observed_at')::timestamptz, now());
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'manual'
     OR v_payment.status NOT IN ('pending', 'awaiting_manual_review') THEN
    RAISE EXCEPTION 'manual payment is not awaiting evidence';
  END IF;
  IF length(v_path) NOT BETWEEN 24 AND 500
     OR v_path !~ '^payment-proofs/[A-Za-z0-9_./-]+$' OR v_path LIKE '%..%'
     OR v_hash !~ '^[a-f0-9]{64}$' OR v_amount <= 0 THEN
    RAISE EXCEPTION 'invalid payment evidence';
  END IF;

  INSERT INTO public.ai_manual_payment_evidence(
    hotel_id, payment_intent_id, object_path, content_sha256,
    observed_amount, observed_at, submitted_by, metadata
  ) VALUES (
    v_payment.hotel_id, v_payment.id, v_path, v_hash, v_amount, v_observed_at,
    COALESCE(NULLIF(p_evidence->>'submitted_by', ''), 'guest'),
    COALESCE(p_evidence->'metadata', '{}'::jsonb)
  ) RETURNING id INTO v_evidence_id;
  UPDATE public.ai_payment_intents SET status = 'awaiting_manual_review', updated_at = now()
  WHERE id = v_payment.id;
  UPDATE public.ai_conversations
  SET journey_stage = 'payment_under_review', human_controlled = true,
      status = 'handed_off', updated_at = now()
  WHERE id = v_payment.conversation_id;
  RETURN v_evidence_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_verify_manual_payment(
  p_payment_intent_id uuid,
  p_reference text,
  p_evidence jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_evidence public.ai_manual_payment_evidence%ROWTYPE;
  v_role text := public.get_user_role();
  v_can_verify boolean;
  v_reservation_id uuid;
BEGIN
  v_can_verify := v_role IN ('admin', 'developer') OR (
    v_role = 'recepcionista' AND COALESCE((SELECT (permissions->>'verify_manual_payments')::boolean
      FROM public.usuarios WHERE id = auth.uid()), false)
  );
  IF auth.uid() IS NULL OR NOT public.is_user_active() OR NOT v_can_verify THEN
    RAISE EXCEPTION 'payment verification privilege required';
  END IF;
  IF length(btrim(COALESCE(p_reference, ''))) < 3 THEN
    RAISE EXCEPTION 'payment reference is required';
  END IF;

  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.provider <> 'manual'
     OR v_payment.status NOT IN ('pending', 'awaiting_manual_review', 'expired') THEN
    RAISE EXCEPTION 'manual payment is not pending review';
  END IF;
  IF v_role <> 'developer' AND v_payment.hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;

  SELECT * INTO v_evidence FROM public.ai_manual_payment_evidence
  WHERE id = (p_evidence->>'evidence_id')::uuid
    AND payment_intent_id = v_payment.id AND verified_at IS NULL
  FOR UPDATE;
  IF NOT FOUND OR abs(v_evidence.observed_amount - v_payment.amount) > 0.01 THEN
    RAISE EXCEPTION 'matching unverified evidence is required';
  END IF;

  INSERT INTO public.ai_payment_events(
    hotel_id, payment_intent_id, provider, provider_event_id, event_type,
    amount, currency, payload
  ) VALUES (
    v_payment.hotel_id, v_payment.id, 'manual',
    'manual:' || v_payment.id::text || ':' || v_evidence.id::text,
    CASE WHEN v_payment.status = 'expired' THEN 'payment.manually_verified_late'
      ELSE 'payment.manually_verified' END,
    v_payment.amount, v_payment.currency,
    jsonb_build_object('reference', btrim(p_reference), 'verified_by', auth.uid(),
      'evidence_id', v_evidence.id, 'content_sha256', v_evidence.content_sha256)
  );
  UPDATE public.ai_manual_payment_evidence SET verified_by = auth.uid(), verified_at = now()
  WHERE id = v_evidence.id;
  UPDATE public.ai_payment_intents
  SET status = 'paid', provider_reference = btrim(p_reference), paid_at = now(),
      verified_at = now(), verified_by = auth.uid(), updated_at = now()
  WHERE id = v_payment.id;

  BEGIN
    v_reservation_id := public.ai_finalize_paid_hold(v_payment.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._ai_mark_payment_reconciliation(v_payment.id,
      'manual finalization error: ' || SQLSTATE || ' ' || SQLERRM);
    v_reservation_id := NULL;
  END;
  PERFORM public._append_audit_event(
    v_payment.hotel_id, auth.uid(), v_role, 'MANUAL_PAYMENT_VERIFIED', 'payments',
    'payment_intent', v_payment.id::text, 'Pago manual verificado con evidencia',
    jsonb_build_object('evidence_id', v_evidence.id, 'reference', btrim(p_reference)), NULL
  );
  RETURN v_reservation_id;
END;
$$;

-- The legacy two-argument verifier can no longer confirm a payment without evidence.
CREATE OR REPLACE FUNCTION public.ai_verify_manual_payment(
  p_payment_intent_id uuid,
  p_reference text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RAISE EXCEPTION 'payment evidence is required; use ai_verify_manual_payment(uuid,text,jsonb)';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_submit_manual_payment_evidence(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_submit_manual_payment_evidence(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ai_verify_manual_payment(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_verify_manual_payment(uuid,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_verify_manual_payment(uuid,text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_reconcile_payment(
  p_payment_intent_id uuid,
  p_resolution text,
  p_note text,
  p_alternate_room_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payment public.ai_payment_intents%ROWTYPE;
  v_hold public.ai_reservation_holds%ROWTYPE;
  v_reconciliation public.ai_payment_reconciliations%ROWTYPE;
  v_role text := public.get_user_role();
  v_reservation_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('admin', 'developer') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO v_payment FROM public.ai_payment_intents
  WHERE id = p_payment_intent_id FOR UPDATE;
  IF NOT FOUND OR v_payment.status <> 'paid_needs_reconciliation' THEN
    RAISE EXCEPTION 'payment is not awaiting reconciliation';
  END IF;
  IF v_role <> 'developer' AND v_payment.hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  IF length(btrim(COALESCE(p_note, ''))) < 5 THEN RAISE EXCEPTION 'resolution note required'; END IF;
  SELECT * INTO v_hold FROM public.ai_reservation_holds WHERE id = v_payment.hold_id FOR UPDATE;
  SELECT * INTO v_reconciliation FROM public.ai_payment_reconciliations
  WHERE payment_intent_id = v_payment.id FOR UPDATE;

  IF p_resolution = 'confirm_alternate_room' THEN
    IF p_alternate_room_id IS NULL THEN RAISE EXCEPTION 'alternate room required'; END IF;
    PERFORM 1 FROM public.habitaciones
    WHERE id = p_alternate_room_id AND hotel_id = v_payment.hotel_id
      AND estado <> 'mantenimiento' FOR UPDATE;
    IF NOT FOUND OR EXISTS (
      SELECT 1 FROM public.reservas r
      WHERE r.hotel_id = v_payment.hotel_id AND r.habitacion_id = p_alternate_room_id
        AND r.estado IN ('pendiente', 'confirmada', 'activa')
        AND daterange(r.fecha_entrada, r.fecha_salida, '[)')
          && daterange(v_hold.fecha_entrada, v_hold.fecha_salida, '[)')
    ) THEN RAISE EXCEPTION 'alternate room is unavailable'; END IF;

    UPDATE public.ai_reservation_holds
    SET habitacion_id = p_alternate_room_id, status = 'payment_pending',
        expires_at = now() + interval '5 minutes', updated_at = now()
    WHERE id = v_hold.id;
    UPDATE public.ai_payment_intents
    SET status = 'paid', reconciliation_reason = NULL, updated_at = now()
    WHERE id = v_payment.id;
    v_reservation_id := public.ai_finalize_paid_hold(v_payment.id);
    IF v_reservation_id IS NULL THEN RAISE EXCEPTION 'alternate room could not be confirmed'; END IF;
    UPDATE public.ai_payment_reconciliations
    SET status = 'resolved', resolution = p_resolution, resolution_note = btrim(p_note),
        alternate_room_id = p_alternate_room_id, resolved_by = auth.uid(),
        resolved_at = now(), updated_at = now()
    WHERE payment_intent_id = v_payment.id;
    UPDATE public.ai_payment_intents SET reconciled_at = now(), reconciled_by = auth.uid()
    WHERE id = v_payment.id;
  ELSIF p_resolution = 'refund_pending' THEN
    UPDATE public.ai_payment_intents SET status = 'refund_pending', reconciled_at = now(),
      reconciled_by = auth.uid(), updated_at = now() WHERE id = v_payment.id;
    UPDATE public.ai_payment_reconciliations
    SET status = 'refund_pending', resolution = p_resolution, resolution_note = btrim(p_note),
      resolved_by = auth.uid(), resolved_at = now(), updated_at = now()
    WHERE payment_intent_id = v_payment.id;
    v_reservation_id := NULL;
  ELSE
    RAISE EXCEPTION 'unsupported reconciliation resolution';
  END IF;

  PERFORM public._append_audit_event(
    v_payment.hotel_id, auth.uid(), v_role, 'PAYMENT_RECONCILED', 'payments',
    'payment_intent', v_payment.id::text, btrim(p_note),
    jsonb_build_object('resolution', p_resolution,
      'alternate_room_id', p_alternate_room_id, 'reservation_id', v_reservation_id), NULL
  );
  RETURN v_reservation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_reconcile_payment(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_reconcile_payment(uuid,text,text,uuid) TO authenticated;

-- --------------------------------------------------------------------------
-- 6. Raw guest credentials are returned only once to a trusted dispatcher
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ai_rotate_guest_access_tokens(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reservation public.reservas%ROWTYPE;
  v_portal_token text;
  v_checkin_token text;
  v_expires_at timestamptz;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_reservation FROM public.reservas
  WHERE id = p_reservation_id AND estado IN ('confirmada', 'activa') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'confirmed reservation not found'; END IF;

  UPDATE public.guest_access_tokens SET revoked_at = now()
  WHERE reservation_id = v_reservation.id AND revoked_at IS NULL AND used_at IS NULL;
  v_portal_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_checkin_token := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  v_expires_at := v_reservation.fecha_salida + interval '1 day';
  INSERT INTO public.guest_access_tokens(reservation_id, token_hash, scope, expires_at)
  VALUES
    (v_reservation.id, encode(digest(v_portal_token, 'sha256'), 'hex'), 'portal', v_expires_at),
    (v_reservation.id, encode(digest(v_checkin_token, 'sha256'), 'hex'), 'checkin', v_expires_at);

  RETURN jsonb_build_object('reservation_id', v_reservation.id,
    'portal_token', v_portal_token, 'checkin_token', v_checkin_token,
    'expires_at', v_expires_at);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_rotate_guest_access_tokens(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_rotate_guest_access_tokens(uuid) TO service_role;

-- Legacy RPC exposed raw tokens directly to the browser and is retired.
REVOKE ALL ON FUNCTION public.generate_reservation_tokens(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ai_enqueue_precheckin_delivery(
  p_hotel_id uuid,
  p_conversation_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_conversation public.ai_conversations%ROWTYPE;
  v_reservation public.reservas%ROWTYPE;
  v_exists boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_conversation FROM public.ai_conversations
  WHERE id = p_conversation_id AND hotel_id = p_hotel_id FOR UPDATE;
  IF NOT FOUND OR v_conversation.reserva_id IS NULL THEN
    RAISE EXCEPTION 'conversation has no reservation';
  END IF;
  SELECT * INTO v_reservation FROM public.reservas
  WHERE id = v_conversation.reserva_id AND hotel_id = p_hotel_id
    AND estado IN ('confirmada', 'activa');
  IF NOT FOUND THEN RAISE EXCEPTION 'confirmed reservation not found'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ai_domain_events
    WHERE hotel_id = p_hotel_id AND aggregate_id = v_reservation.id
      AND event_type = 'guest_access.delivery_requested'
      AND status IN ('pending', 'processing')
  ) INTO v_exists;
  IF NOT v_exists THEN
    INSERT INTO public.ai_domain_events(hotel_id, aggregate_type, aggregate_id, event_type, payload)
    VALUES (
      p_hotel_id, 'reservation', v_reservation.id, 'guest_access.delivery_requested',
      jsonb_build_object('conversation_id', p_conversation_id,
        'reservation_id', v_reservation.id, 'delivery_kind', 'precheckin')
    );
  END IF;
  UPDATE public.ai_conversations SET journey_stage = 'pre_checkin', updated_at = now()
  WHERE id = p_conversation_id;
  RETURN jsonb_build_object('success', true, 'queued', NOT v_exists);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_enqueue_precheckin_delivery(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_enqueue_precheckin_delivery(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_checkin_context(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT jsonb_build_object(
    'reservation_id', r.id, 'reservation_number', r.numero_reserva,
    'hotel_id', r.hotel_id, 'guest_name', r.huesped_nombre,
    'document_type', r.tipo_documento, 'check_in', r.fecha_entrada,
    'check_out', r.fecha_salida, 'room_number', r.habitacion_numero
  ) INTO v_result
  FROM public.guest_access_tokens t
  JOIN public.reservas r ON r.id = t.reservation_id
  WHERE t.token_hash = p_token_hash AND t.scope = 'checkin'
    AND t.revoked_at IS NULL AND t.used_at IS NULL AND t.expires_at > now()
    AND r.estado IN ('confirmada', 'activa');
  IF v_result IS NULL THEN RAISE EXCEPTION 'invalid or expired check-in token'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_checkin_atomic(
  p_token_hash text,
  p_guest jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_token public.guest_access_tokens%ROWTYPE;
  v_reservation public.reservas%ROWTYPE;
  v_checkin public.checkins_publicos%ROWTYPE;
  v_type text := COALESCE(NULLIF(btrim(p_guest->>'tipo_documento'), ''), 'DNI');
  v_document text := btrim(COALESCE(p_guest->>'documento', ''));
  v_name text := btrim(COALESCE(p_guest->>'nombre', ''));
  v_phone text := btrim(COALESCE(p_guest->>'telefono', ''));
  v_email text := NULLIF(btrim(COALESCE(p_guest->>'email', '')), '');
  v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_token FROM public.guest_access_tokens
  WHERE token_hash = p_token_hash AND scope = 'checkin'
    AND revoked_at IS NULL AND used_at IS NULL AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or expired check-in token'; END IF;
  SELECT * INTO v_reservation FROM public.reservas
  WHERE id = v_token.reservation_id AND estado IN ('confirmada', 'activa') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation is not eligible for pre check-in'; END IF;
  IF upper(v_type) NOT IN ('DNI', 'CE', 'PASAPORTE')
     OR length(v_name) NOT BETWEEN 3 AND 150 OR length(v_phone) NOT BETWEEN 6 AND 30
     OR NOT public.validate_guest_document(v_type, v_document)
     OR (v_email IS NOT NULL AND v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN
    RAISE EXCEPTION 'invalid guest data';
  END IF;

  INSERT INTO public.checkins_publicos(
    reservation_id, hotel_id, nombre, tipo_documento, documento,
    telefono, email, observaciones, estado
  ) VALUES (
    v_reservation.id, v_reservation.hotel_id, v_name,
    CASE upper(v_type) WHEN 'PASAPORTE' THEN 'Pasaporte' ELSE upper(v_type) END,
    v_document, v_phone, v_email, NULLIF(btrim(p_guest->>'observaciones'), ''), 'pendiente'
  ) ON CONFLICT (reservation_id) DO UPDATE SET
    nombre = EXCLUDED.nombre, tipo_documento = EXCLUDED.tipo_documento,
    documento = EXCLUDED.documento, telefono = EXCLUDED.telefono,
    email = EXCLUDED.email, observaciones = EXCLUDED.observaciones
  WHERE public.checkins_publicos.estado = 'pendiente'
  RETURNING * INTO v_checkin;
  IF NOT FOUND THEN RAISE EXCEPTION 'validated check-in cannot be changed'; END IF;

  UPDATE public.guest_access_tokens SET used_at = now()
  WHERE id = v_token.id AND used_at IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'check-in token was already consumed'; END IF;

  PERFORM public._append_audit_event(
    v_reservation.hotel_id, NULL, 'guest', 'PUBLIC_PRECHECKIN_SUBMITTED', 'checkin',
    'reserva', v_reservation.id::text, 'Pre check-in público enviado',
    jsonb_build_object('checkin_id', v_checkin.id), NULL
  );
  RETURN jsonb_build_object('success', true, 'checkin_id', v_checkin.id,
    'reservation_number', v_reservation.numero_reserva, 'status', v_checkin.estado);
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_checkin_context(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_checkin_context(text) TO service_role;
REVOKE ALL ON FUNCTION public.submit_public_checkin_atomic(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_public_checkin_atomic(text,jsonb) TO service_role;

-- --------------------------------------------------------------------------
-- 7. Durable outbound queue and consumable transactional outbox
-- --------------------------------------------------------------------------

ALTER TABLE public.ai_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_delivery_attempts integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter_at timestamptz;

ALTER TABLE public.ai_messages ADD CONSTRAINT uq_ai_messages_id_hotel UNIQUE (id, hotel_id);
ALTER TABLE public.ai_messages ADD CONSTRAINT fk_ai_messages_reply_hotel
  FOREIGN KEY (reply_to_message_id, hotel_id)
  REFERENCES public.ai_messages(id, hotel_id);
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_attempts_check
  CHECK (delivery_attempts >= 0 AND max_delivery_attempts BETWEEN 1 AND 50);
CREATE UNIQUE INDEX uq_ai_assistant_reply_once
  ON public.ai_messages(reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL AND role = 'assistant' AND direction = 'outbound';

ALTER TABLE public.ai_messages DROP CONSTRAINT IF EXISTS ai_messages_delivery_status_check;
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_delivery_status_check
  CHECK (delivery_status IN (
    'received', 'queued', 'processing', 'delayed', 'sent', 'delivered',
    'read', 'failed', 'cancelled', 'dead_letter'
  ));

UPDATE public.ai_messages
SET delivery_status = 'queued', lease_owner = NULL, lease_expires_at = NULL,
    next_attempt_at = now()
WHERE delivery_status = 'processing' AND lease_expires_at IS NULL;

CREATE INDEX idx_ai_messages_delivery_queue
  ON public.ai_messages(hotel_id, delivery_status, next_attempt_at, created_at)
  WHERE direction = 'outbound' AND delivery_status IN ('queued', 'processing');

ALTER TABLE public.ai_domain_events
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS dead_letter_at timestamptz;

ALTER TABLE public.ai_domain_events DROP CONSTRAINT IF EXISTS ai_domain_events_status_check;
ALTER TABLE public.ai_domain_events ADD CONSTRAINT ai_domain_events_status_check
  CHECK (status IN ('pending', 'processing', 'published', 'failed', 'dead_letter'));
ALTER TABLE public.ai_domain_events ADD CONSTRAINT ai_domain_events_attempts_check
  CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 100);
UPDATE public.ai_domain_events SET status = 'pending', lease_owner = NULL,
  lease_expires_at = NULL, next_attempt_at = now()
WHERE status = 'processing' AND lease_expires_at IS NULL;
CREATE INDEX idx_ai_domain_events_claim
  ON public.ai_domain_events(hotel_id, status, next_attempt_at, available_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE OR REPLACE FUNCTION public.ai_claim_channel_messages_v2(
  p_hotel_id uuid,
  p_channel text,
  p_external_account_id text,
  p_worker_id text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_messages jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_channel NOT IN ('whatsapp', 'instagram', 'facebook', 'guest_portal')
     OR length(btrim(COALESCE(p_worker_id, ''))) NOT BETWEEN 8 AND 200
     OR p_lease_seconds NOT BETWEEN 15 AND 600 THEN RAISE EXCEPTION 'invalid claim parameters'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_channel_connections cc
    WHERE cc.hotel_id = p_hotel_id AND cc.channel = p_channel
      AND cc.external_account_id = p_external_account_id
      AND cc.enabled AND cc.status IN ('connected', 'degraded')
  ) THEN RAISE EXCEPTION 'channel connection is not active'; END IF;

  UPDATE public.ai_messages
  SET delivery_status = CASE WHEN delivery_attempts >= max_delivery_attempts
        THEN 'dead_letter' ELSE 'queued' END,
      dead_letter_at = CASE WHEN delivery_attempts >= max_delivery_attempts
        THEN now() ELSE dead_letter_at END,
      lease_owner = NULL, lease_expires_at = NULL,
      next_attempt_at = CASE WHEN delivery_attempts >= max_delivery_attempts
        THEN next_attempt_at ELSE now() END,
      error_code = COALESCE(error_code, 'lease_expired')
  WHERE hotel_id = p_hotel_id AND direction = 'outbound'
    AND delivery_status = 'processing' AND lease_expires_at <= now();

  WITH candidates AS (
    SELECT m.id
    FROM public.ai_messages m
    JOIN public.ai_conversations c
      ON c.id = m.conversation_id AND c.hotel_id = m.hotel_id
    WHERE m.hotel_id = p_hotel_id AND m.direction = 'outbound'
      AND m.delivery_status = 'queued' AND m.next_attempt_at <= now()
      AND m.delivery_attempts < m.max_delivery_attempts
      AND c.channel = p_channel AND c.external_account_id = p_external_account_id
    ORDER BY m.next_attempt_at, m.created_at
    FOR UPDATE OF m SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ), claimed AS (
    UPDATE public.ai_messages m
    SET delivery_status = 'processing', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      delivery_attempts = m.delivery_attempts + 1, last_attempt_at = now()
    WHERE m.id IN (SELECT id FROM candidates)
    RETURNING m.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'message_id', cm.id, 'conversation_id', cm.conversation_id,
    'external_contact_id', c.external_contact_id, 'content', cm.content,
    'reply_to_message_id', cm.reply_to_message_id,
    'attempt', cm.delivery_attempts, 'lease_expires_at', cm.lease_expires_at,
    'created_at', cm.created_at
  ) ORDER BY cm.created_at), '[]'::jsonb)
  INTO v_messages
  FROM claimed cm
  JOIN public.ai_conversations c
    ON c.id = cm.conversation_id AND c.hotel_id = cm.hotel_id;
  RETURN v_messages;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_ack_channel_message(
  p_message_id uuid,
  p_worker_id text,
  p_external_message_id text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF length(btrim(COALESCE(p_external_message_id, ''))) < 1 THEN
    RAISE EXCEPTION 'external message id required';
  END IF;
  UPDATE public.ai_messages SET delivery_status = 'sent',
    external_message_id = COALESCE(external_message_id, btrim(p_external_message_id)),
    lease_owner = NULL, lease_expires_at = NULL, error_code = NULL
  WHERE id = p_message_id AND delivery_status = 'processing'
    AND lease_owner = p_worker_id AND lease_expires_at > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_nack_channel_message(
  p_message_id uuid,
  p_worker_id text,
  p_error text,
  p_permanent boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_messages SET
    delivery_status = CASE WHEN p_permanent OR delivery_attempts >= max_delivery_attempts
      THEN 'dead_letter' ELSE 'queued' END,
    dead_letter_at = CASE WHEN p_permanent OR delivery_attempts >= max_delivery_attempts
      THEN now() ELSE NULL END,
    next_attempt_at = CASE WHEN p_permanent OR delivery_attempts >= max_delivery_attempts
      THEN next_attempt_at
      ELSE now() + make_interval(secs => LEAST(3600, (power(2, LEAST(delivery_attempts, 10)) * 5)::integer)) END,
    lease_owner = NULL, lease_expires_at = NULL, error_code = left(COALESCE(p_error, 'delivery_failed'), 500)
  WHERE id = p_message_id AND delivery_status = 'processing'
    AND lease_owner = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_update_delivery_status(
  p_message_id uuid,
  p_status text,
  p_external_message_id text DEFAULT NULL,
  p_error text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_status NOT IN ('sent', 'delivered', 'read', 'failed') THEN
    RAISE EXCEPTION 'invalid delivery status';
  END IF;
  UPDATE public.ai_messages SET delivery_status = p_status,
    external_message_id = COALESCE(NULLIF(p_external_message_id, ''), external_message_id),
    error_code = CASE WHEN p_status = 'failed' THEN left(p_error, 500) ELSE error_code END
  WHERE id = p_message_id AND direction = 'outbound'
    AND delivery_status NOT IN ('cancelled', 'dead_letter');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_claim_domain_events(
  p_hotel_id uuid,
  p_worker_id text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_events jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF length(btrim(COALESCE(p_worker_id, ''))) NOT BETWEEN 8 AND 200
     OR p_lease_seconds NOT BETWEEN 15 AND 600 THEN RAISE EXCEPTION 'invalid claim parameters'; END IF;

  UPDATE public.ai_domain_events SET
    status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
    dead_letter_at = CASE WHEN attempts >= max_attempts THEN now() ELSE dead_letter_at END,
    lease_owner = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN attempts >= max_attempts THEN next_attempt_at ELSE now() END,
    last_error = COALESCE(last_error, 'lease_expired')
  WHERE hotel_id = p_hotel_id AND status = 'processing' AND lease_expires_at <= now();

  WITH candidates AS (
    SELECT id FROM public.ai_domain_events
    WHERE hotel_id = p_hotel_id AND status = 'pending'
      AND available_at <= now() AND next_attempt_at <= now() AND attempts < max_attempts
    ORDER BY next_attempt_at, created_at
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ), claimed AS (
    UPDATE public.ai_domain_events e SET status = 'processing', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = e.attempts + 1
    WHERE e.id IN (SELECT id FROM candidates)
    RETURNING e.*
  ) SELECT COALESCE(jsonb_agg(to_jsonb(claimed) ORDER BY created_at), '[]'::jsonb)
    INTO v_events FROM claimed;
  RETURN v_events;
END;
$$;

-- Channel-scoped outbox claim. Events without a conversation are intentionally
-- excluded and remain available only to the internal hotel-scoped worker above.
CREATE OR REPLACE FUNCTION public.ai_claim_domain_events_v2(
  p_hotel_id uuid,
  p_channel text,
  p_external_account_id text,
  p_worker_id text,
  p_limit integer DEFAULT 10,
  p_lease_seconds integer DEFAULT 60
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_events jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_channel NOT IN ('whatsapp', 'instagram', 'facebook', 'guest_portal')
     OR length(btrim(COALESCE(p_worker_id, ''))) NOT BETWEEN 8 AND 200
     OR p_lease_seconds NOT BETWEEN 15 AND 600 THEN RAISE EXCEPTION 'invalid claim parameters'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.ai_channel_connections cc
    WHERE cc.hotel_id = p_hotel_id AND cc.channel = p_channel
      AND cc.external_account_id = p_external_account_id
      AND cc.enabled AND cc.status IN ('connected', 'degraded')
  ) THEN RAISE EXCEPTION 'channel connection is not active'; END IF;

  UPDATE public.ai_domain_events SET
    status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
    dead_letter_at = CASE WHEN attempts >= max_attempts THEN now() ELSE dead_letter_at END,
    lease_owner = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN attempts >= max_attempts THEN next_attempt_at ELSE now() END,
    last_error = COALESCE(last_error, 'lease_expired')
  WHERE hotel_id = p_hotel_id AND status = 'processing' AND lease_expires_at <= now();

  WITH candidates AS (
    SELECT e.id
    FROM public.ai_domain_events e
    JOIN public.ai_conversations c
      ON e.payload->>'conversation_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND c.id = (e.payload->>'conversation_id')::uuid
      AND c.hotel_id = e.hotel_id
    WHERE e.hotel_id = p_hotel_id AND e.status = 'pending'
      AND e.available_at <= now() AND e.next_attempt_at <= now()
      AND e.attempts < e.max_attempts
      AND c.channel = p_channel AND c.external_account_id = p_external_account_id
    ORDER BY e.next_attempt_at, e.created_at
    FOR UPDATE OF e SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ), claimed AS (
    UPDATE public.ai_domain_events e SET status = 'processing', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = e.attempts + 1
    WHERE e.id IN (SELECT id FROM candidates)
    RETURNING e.*
  ) SELECT COALESCE(jsonb_agg(to_jsonb(claimed) ORDER BY created_at), '[]'::jsonb)
    INTO v_events FROM claimed;
  RETURN v_events;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_ack_domain_event(p_event_id uuid, p_worker_id text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_domain_events SET status = 'published', published_at = now(),
    lease_owner = NULL, lease_expires_at = NULL, last_error = NULL
  WHERE id = p_event_id AND status = 'processing' AND lease_owner = p_worker_id
    AND lease_expires_at > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_nack_domain_event(
  p_event_id uuid, p_worker_id text, p_error text, p_permanent boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_domain_events SET
    status = CASE WHEN p_permanent OR attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
    dead_letter_at = CASE WHEN p_permanent OR attempts >= max_attempts THEN now() ELSE NULL END,
    next_attempt_at = CASE WHEN p_permanent OR attempts >= max_attempts THEN next_attempt_at
      ELSE now() + make_interval(secs => LEAST(3600, (power(2, LEAST(attempts, 10)) * 5)::integer)) END,
    lease_owner = NULL, lease_expires_at = NULL, last_error = left(COALESCE(p_error, 'publish_failed'), 2000)
  WHERE id = p_event_id AND status = 'processing' AND lease_owner = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_claim_channel_messages(uuid,text,text,integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.ai_claim_channel_messages_v2(uuid,text,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_claim_channel_messages_v2(uuid,text,text,text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ai_ack_channel_message(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_ack_channel_message(uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.ai_nack_channel_message(uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_nack_channel_message(uuid,text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.ai_update_delivery_status(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_update_delivery_status(uuid,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.ai_claim_domain_events(uuid,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_claim_domain_events(uuid,text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ai_claim_domain_events_v2(uuid,text,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_claim_domain_events_v2(uuid,text,text,text,integer,integer)
  TO service_role;
REVOKE ALL ON FUNCTION public.ai_ack_domain_event(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_ack_domain_event(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.ai_nack_domain_event(uuid,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_nack_domain_event(uuid,text,text,boolean) TO service_role;

-- --------------------------------------------------------------------------
-- 8. Per-connection encrypted credentials and nonce replay protection
-- --------------------------------------------------------------------------

ALTER TABLE public.ai_channel_connections
  ADD COLUMN IF NOT EXISTS credential_id text,
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS secret_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE UNIQUE INDEX uq_ai_channel_connection_credential
  ON public.ai_channel_connections(credential_id) WHERE credential_id IS NOT NULL;

CREATE TABLE private.ai_channel_credentials (
  connection_id uuid PRIMARY KEY REFERENCES public.ai_channel_connections(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  encrypted_secret text NOT NULL,
  credential_version integer NOT NULL CHECK (credential_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.ai_channel_credentials FROM PUBLIC, anon, authenticated;

CREATE TABLE private.ai_channel_nonces (
  credential_id text NOT NULL REFERENCES private.ai_channel_credentials(credential_id) ON DELETE CASCADE,
  nonce text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (credential_id, nonce)
);
CREATE INDEX idx_ai_channel_nonces_expiry ON private.ai_channel_nonces(expires_at);
REVOKE ALL ON private.ai_channel_nonces FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ai_store_channel_credential(
  p_connection_id uuid,
  p_credential_id text,
  p_encrypted_secret text,
  p_version integer
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
DECLARE v_connection public.ai_channel_connections%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_credential_id !~ '^[A-Za-z0-9_-]{16,128}$'
     OR length(p_encrypted_secret) NOT BETWEEN 40 AND 4000 OR p_version < 1 THEN
    RAISE EXCEPTION 'invalid credential material';
  END IF;
  SELECT * INTO v_connection FROM public.ai_channel_connections
  WHERE id = p_connection_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'channel connection not found'; END IF;
  INSERT INTO private.ai_channel_credentials(
    connection_id, credential_id, encrypted_secret, credential_version
  ) VALUES (p_connection_id, p_credential_id, p_encrypted_secret, p_version)
  ON CONFLICT (connection_id) DO UPDATE SET
    credential_id = EXCLUDED.credential_id,
    encrypted_secret = EXCLUDED.encrypted_secret,
    credential_version = EXCLUDED.credential_version,
    rotated_at = now();
  UPDATE public.ai_channel_connections SET credential_id = p_credential_id,
    credential_version = p_version, secret_rotated_at = now(), revoked_at = NULL,
    updated_at = now() WHERE id = p_connection_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_get_channel_credential(p_credential_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT jsonb_build_object(
    'connection_id', c.id, 'hotel_id', c.hotel_id, 'channel', c.channel,
    'external_account_id', c.external_account_id, 'credential_id', cr.credential_id,
    'credential_version', cr.credential_version, 'encrypted_secret', cr.encrypted_secret,
    'enabled', c.enabled, 'status', c.status, 'revoked_at', c.revoked_at
  ) INTO v_result
  FROM private.ai_channel_credentials cr
  JOIN public.ai_channel_connections c ON c.id = cr.connection_id
  WHERE cr.credential_id = p_credential_id AND c.revoked_at IS NULL;
  IF v_result IS NULL THEN RAISE EXCEPTION 'channel credential not found or revoked'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_consume_channel_nonce(
  p_credential_id text,
  p_nonce text,
  p_expires_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
DECLARE v_connection_id uuid;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_nonce !~ '^[A-Za-z0-9_-]{16,200}$'
     OR p_expires_at <= now() OR p_expires_at > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'invalid nonce window';
  END IF;
  SELECT connection_id INTO v_connection_id FROM private.ai_channel_credentials
  WHERE credential_id = p_credential_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'credential not found'; END IF;
  INSERT INTO private.ai_channel_nonces(credential_id, nonce, expires_at)
  VALUES (p_credential_id, p_nonce, p_expires_at);
  RETURN v_connection_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'replayed nonce';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_store_channel_credential(uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_store_channel_credential(uuid,text,text,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ai_get_channel_credential(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_get_channel_credential(text) TO service_role;
REVOKE ALL ON FUNCTION public.ai_consume_channel_nonce(text,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_consume_channel_nonce(text,text,timestamptz) TO service_role;

-- --------------------------------------------------------------------------
-- 9. Server-owned reservation transitions, staff availability and handoff
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.staff_search_availability(
  p_hotel_id uuid,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_adultos integer DEFAULT 1,
  p_ninos integer DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hoteles WHERE id = p_hotel_id AND activo) THEN
    RAISE EXCEPTION 'hotel is inactive';
  END IF;
  RETURN public.ai_search_availability_v2(
    p_hotel_id, p_fecha_entrada, p_fecha_salida, p_adultos, p_ninos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.staff_search_availability(uuid,date,date,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_search_availability(uuid,date,date,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_reservation_atomic(
  p_hotel_id uuid,
  p_habitacion_id uuid,
  p_habitacion_numero text,
  p_habitacion_tipo text,
  p_huesped_nombre text,
  p_huesped_dni text,
  p_fecha_entrada date,
  p_fecha_salida date,
  p_noches integer,
  p_precio_noche numeric,
  p_total numeric,
  p_estado text DEFAULT 'pendiente',
  p_huesped_telefono text DEFAULT NULL,
  p_huesped_email text DEFAULT NULL,
  p_huesped_sexo text DEFAULT NULL,
  p_huesped_fecha_nacimiento date DEFAULT NULL,
  p_huesped_procedencia text DEFAULT NULL,
  p_huesped_destino text DEFAULT NULL,
  p_huesped_profesion text DEFAULT NULL,
  p_huesped_estado_civil text DEFAULT NULL,
  p_nacionalidad text DEFAULT NULL,
  p_motivo_viaje text DEFAULT NULL,
  p_tipo_documento text DEFAULT 'DNI',
  p_tiene_menores boolean DEFAULT false,
  p_observaciones text DEFAULT NULL,
  p_origen text DEFAULT 'recepcion',
  p_servicios_extra_ids jsonb DEFAULT '[]'::jsonb
) RETURNS public.reservas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_room public.habitaciones%ROWTYPE;
  v_price jsonb;
  v_server_nights integer;
  v_server_rate numeric;
  v_server_total numeric;
  v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  IF p_fecha_entrada < CURRENT_DATE OR p_fecha_salida <= p_fecha_entrada
     OR p_fecha_salida - p_fecha_entrada > 365 THEN RAISE EXCEPTION 'invalid stay dates'; END IF;
  IF p_estado NOT IN ('pendiente', 'confirmada', 'activa') THEN
    RAISE EXCEPTION 'invalid initial reservation state';
  END IF;
  IF p_estado = 'activa' AND p_fecha_entrada > CURRENT_DATE THEN
    RAISE EXCEPTION 'a future stay cannot be activated';
  END IF;
  IF length(btrim(COALESCE(p_huesped_nombre, ''))) NOT BETWEEN 3 AND 150 THEN
    RAISE EXCEPTION 'invalid guest name';
  END IF;
  IF COALESCE(btrim(p_huesped_dni), '') <> ''
     AND NOT public.validate_guest_document(p_tipo_documento, p_huesped_dni) THEN
    RAISE EXCEPTION 'invalid guest document';
  END IF;

  SELECT * INTO v_room FROM public.habitaciones
  WHERE id = p_habitacion_id AND hotel_id = p_hotel_id FOR UPDATE;
  IF NOT FOUND OR v_room.estado = 'mantenimiento' THEN RAISE EXCEPTION 'room unavailable'; END IF;
  v_price := public.ai_calculate_room_quote(
    p_hotel_id, p_habitacion_id, p_fecha_entrada, p_fecha_salida
  );
  v_server_nights := (v_price->>'nights')::integer;
  v_server_rate := (v_price->>'nightly_rate')::numeric;
  v_server_total := (v_price->>'total')::numeric;
  IF p_noches <> v_server_nights OR abs(p_precio_noche - v_server_rate) > 0.01
     OR abs(p_total - v_server_total) > 0.01 THEN
    RAISE EXCEPTION 'reservation price must match server quote';
  END IF;

  INSERT INTO public.reservas(
    hotel_id, habitacion_id, habitacion_numero, habitacion_tipo, numero_reserva,
    estado, huesped_nombre, huesped_dni, huesped_telefono, huesped_email,
    huesped_sexo, huesped_fecha_nacimiento, huesped_procedencia, huesped_destino,
    huesped_profesion, huesped_estado_civil, nacionalidad, motivo_viaje,
    tipo_documento, tiene_menores, fecha_entrada, fecha_salida, noches,
    precio_noche, total, observaciones, origen, servicios_extra_ids
  ) VALUES (
    p_hotel_id, v_room.id, v_room.numero, v_room.tipo,
    'R-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    p_estado, btrim(p_huesped_nombre), NULLIF(btrim(p_huesped_dni), ''),
    NULLIF(btrim(p_huesped_telefono), ''), NULLIF(btrim(p_huesped_email), ''),
    p_huesped_sexo, p_huesped_fecha_nacimiento::text, p_huesped_procedencia,
    p_huesped_destino, p_huesped_profesion, p_huesped_estado_civil,
    p_nacionalidad, p_motivo_viaje,
    CASE upper(p_tipo_documento) WHEN 'PASAPORTE' THEN 'Pasaporte' ELSE upper(p_tipo_documento) END,
    p_tiene_menores, p_fecha_entrada, p_fecha_salida, v_server_nights,
    v_server_rate, v_server_total, p_observaciones, p_origen,
    COALESCE(p_servicios_extra_ids, '[]'::jsonb)
  ) RETURNING * INTO v_reserva;
  UPDATE public.habitaciones SET estado = CASE WHEN p_estado = 'activa' THEN 'ocupada' ELSE 'reservada' END
  WHERE id = v_room.id;
  PERFORM public._append_audit_event(
    p_hotel_id, auth.uid(), v_role, 'RESERVATION_CREATED', 'reservas',
    'reserva', v_reserva.id::text, 'Reserva creada con tarifa verificada por servidor',
    jsonb_build_object('room_id', v_room.id, 'total', v_server_total, 'state', p_estado), NULL
  );
  RETURN v_reserva;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation_atomic(
  uuid,uuid,text,text,text,text,date,date,integer,numeric,numeric,text,text,text,text,date,
  text,text,text,text,text,text,text,boolean,text,text,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_reservation_atomic(
  uuid,uuid,text,text,text,text,date,date,integer,numeric,numeric,text,text,text,text,date,
  text,text,text,text,text,text,text,boolean,text,text,jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_reservation_state_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.estado = 'activa' AND NEW.fecha_entrada > CURRENT_DATE THEN
      RAISE EXCEPTION 'a future stay cannot be activated';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado THEN RETURN NEW; END IF;
  IF NOT (
    (OLD.estado = 'pendiente' AND NEW.estado IN ('confirmada', 'cancelada')) OR
    (OLD.estado = 'confirmada' AND NEW.estado IN ('activa', 'cancelada')) OR
    (OLD.estado = 'activa' AND NEW.estado = 'finalizada')
  ) THEN RAISE EXCEPTION 'invalid reservation transition: % -> %', OLD.estado, NEW.estado; END IF;
  IF NEW.estado = 'activa' AND NEW.fecha_entrada > CURRENT_DATE THEN
    RAISE EXCEPTION 'a future stay cannot be activated';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reservation_state_transition ON public.reservas;
CREATE TRIGGER trg_reservation_state_transition
  BEFORE INSERT OR UPDATE OF estado ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reservation_state_transition();

CREATE OR REPLACE FUNCTION public.update_reservation_status_atomic(
  p_reserva_id uuid,
  p_nuevo_estado text,
  p_next_room_status text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reserva public.reservas%ROWTYPE;
  v_role text := public.get_user_role();
  v_derived_room_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  SELECT * INTO v_reserva FROM public.reservas WHERE id = p_reserva_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reservation not found'; END IF;
  IF v_role <> 'developer' AND v_reserva.hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  IF p_nuevo_estado = v_reserva.estado THEN RETURN true; END IF;
  IF NOT (
    (v_reserva.estado = 'pendiente' AND p_nuevo_estado IN ('confirmada', 'cancelada')) OR
    (v_reserva.estado = 'confirmada' AND p_nuevo_estado IN ('activa', 'cancelada')) OR
    (v_reserva.estado = 'activa' AND p_nuevo_estado = 'finalizada')
  ) THEN RAISE EXCEPTION 'invalid reservation transition'; END IF;
  IF p_nuevo_estado = 'activa' AND v_reserva.fecha_entrada > CURRENT_DATE THEN
    RAISE EXCEPTION 'a future stay cannot be activated';
  END IF;

  UPDATE public.reservas SET estado = p_nuevo_estado WHERE id = p_reserva_id;
  IF v_reserva.habitacion_id IS NOT NULL THEN
    v_derived_room_status := CASE p_nuevo_estado
      WHEN 'activa' THEN 'ocupada'
      WHEN 'finalizada' THEN 'limpieza'
      WHEN 'confirmada' THEN 'reservada'
      ELSE NULL END;
    IF v_derived_room_status IS NULL THEN
      v_derived_room_status := public.refresh_room_operational_status(v_reserva.habitacion_id);
    ELSE
      UPDATE public.habitaciones SET estado = v_derived_room_status
      WHERE id = v_reserva.habitacion_id AND estado <> 'mantenimiento';
    END IF;
    IF p_next_room_status IS NOT NULL AND p_next_room_status <> v_derived_room_status THEN
      RAISE EXCEPTION 'client room status conflicts with server transition';
    END IF;
  END IF;
  PERFORM public._append_audit_event(
    v_reserva.hotel_id, auth.uid(), v_role, 'RESERVATION_STATUS_CHANGED', 'reservas',
    'reserva', v_reserva.id::text,
    format('Estado %s -> %s', v_reserva.estado, p_nuevo_estado),
    jsonb_build_object('from', v_reserva.estado, 'to', p_nuevo_estado), NULL
  );
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_take_over_conversation(p_conversation_id uuid)
RETURNS public.ai_conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.ai_conversations%ROWTYPE; v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO v_row FROM public.ai_conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR (v_role <> 'developer' AND v_row.hotel_id <> public.get_user_hotel_id()) THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;
  UPDATE public.ai_conversations SET human_controlled = true, assigned_user_id = auth.uid(),
    status = 'handed_off',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      '_pre_handoff_stage', journey_stage, '_pre_handoff_status', status),
    journey_stage = 'handed_off', updated_at = now()
  WHERE id = p_conversation_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_send_human_message(
  p_conversation_id uuid,
  p_content text
) RETURNS public.ai_messages
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_conversation public.ai_conversations%ROWTYPE; v_message public.ai_messages%ROWTYPE;
  v_role text := public.get_user_role();
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer')
     OR length(btrim(COALESCE(p_content, ''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'invalid human message request';
  END IF;
  SELECT * INTO v_conversation FROM public.ai_conversations
  WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR (v_role <> 'developer' AND v_conversation.hotel_id <> public.get_user_hotel_id()) THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;
  IF NOT v_conversation.human_controlled
     OR (v_conversation.assigned_user_id IS DISTINCT FROM auth.uid() AND v_role NOT IN ('admin', 'developer')) THEN
    RAISE EXCEPTION 'conversation must be assigned to this operator';
  END IF;
  INSERT INTO public.ai_messages(
    conversation_id, hotel_id, role, content, direction, delivery_status
  ) VALUES (
    v_conversation.id, v_conversation.hotel_id, 'assistant', btrim(p_content),
    'outbound', 'queued'
  ) RETURNING * INTO v_message;
  UPDATE public.ai_conversations SET last_outbound_at = now(), updated_at = now()
  WHERE id = v_conversation.id;
  RETURN v_message;
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_release_conversation(p_conversation_id uuid)
RETURNS public.ai_conversations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.ai_conversations%ROWTYPE; v_role text := public.get_user_role();
  v_stage text; v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active()
     OR v_role NOT IN ('recepcionista', 'admin', 'developer') THEN RAISE EXCEPTION 'not authorized'; END IF;
  SELECT * INTO v_row FROM public.ai_conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR (v_role <> 'developer' AND v_row.hotel_id <> public.get_user_hotel_id()) THEN
    RAISE EXCEPTION 'conversation not found';
  END IF;
  IF v_row.assigned_user_id IS DISTINCT FROM auth.uid() AND v_role NOT IN ('admin', 'developer') THEN
    RAISE EXCEPTION 'conversation is assigned to another operator';
  END IF;
  v_stage := COALESCE(NULLIF(v_row.metadata->>'_pre_handoff_stage', ''),
    CASE WHEN v_row.reserva_id IS NOT NULL THEN 'reservation_confirmed' ELSE 'lead' END);
  IF v_stage IN ('handed_off', 'payment_reconciliation', 'closed') THEN v_stage := 'lead'; END IF;
  v_status := CASE
    WHEN v_row.reserva_id IS NOT NULL THEN 'booked'
    WHEN v_stage IN ('payment_pending', 'payment_under_review') THEN 'payment_pending'
    WHEN v_stage IN ('quote_created', 'quote_accepted', 'reservation_hold') THEN 'quoted'
    ELSE 'active' END;
  UPDATE public.ai_conversations SET human_controlled = false, assigned_user_id = NULL,
    journey_stage = v_stage, status = v_status,
    metadata = COALESCE(metadata, '{}'::jsonb) - '_pre_handoff_stage' - '_pre_handoff_status',
    updated_at = now()
  WHERE id = p_conversation_id RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.update_reservation_status_atomic(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_atomic(uuid,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_take_over_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_take_over_conversation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_send_human_message(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_send_human_message(uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION public.ai_release_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_release_conversation(uuid) TO authenticated;

-- Revocable hashed client sessions for web/guest channels.
CREATE TABLE public.ai_client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  conversation_id uuid,
  channel text NOT NULL CHECK (channel IN ('web', 'guest_portal')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_ai_client_session_conversation_hotel
    FOREIGN KEY (conversation_id, hotel_id)
    REFERENCES public.ai_conversations(id, hotel_id) ON DELETE CASCADE
);
CREATE INDEX idx_ai_client_sessions_expiry ON public.ai_client_sessions(expires_at);
ALTER TABLE public.ai_client_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_client_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ai_create_client_session(
  p_hotel_id uuid, p_channel text, p_conversation_id uuid DEFAULT NULL,
  p_ttl_minutes integer DEFAULT 1440
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_raw text; v_row public.ai_client_sessions%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF p_channel NOT IN ('web', 'guest_portal') OR p_ttl_minutes NOT BETWEEN 5 AND 10080 THEN
    RAISE EXCEPTION 'invalid client session';
  END IF;
  IF p_conversation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ai_conversations WHERE id = p_conversation_id AND hotel_id = p_hotel_id
  ) THEN RAISE EXCEPTION 'conversation mismatch'; END IF;
  v_raw := replace(replace(replace(encode(gen_random_bytes(32), 'base64'), '+', '-'), '/', '_'), '=', '');
  INSERT INTO public.ai_client_sessions(hotel_id, conversation_id, channel, token_hash, expires_at)
  VALUES (p_hotel_id, p_conversation_id, p_channel,
    encode(digest(v_raw, 'sha256'), 'hex'), now() + make_interval(mins => p_ttl_minutes))
  RETURNING * INTO v_row;
  RETURN jsonb_build_object('session_id', v_row.id, 'session_token', v_raw,
    'expires_at', v_row.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_validate_client_session(
  p_hotel_id uuid, p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.ai_client_sessions%ROWTYPE;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  SELECT * INTO v_row FROM public.ai_client_sessions
  WHERE hotel_id = p_hotel_id
    AND token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
    AND revoked_at IS NULL AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid or revoked client session'; END IF;
  UPDATE public.ai_client_sessions SET last_seen_at = now() WHERE id = v_row.id;
  RETURN jsonb_build_object('session_id', v_row.id, 'hotel_id', v_row.hotel_id,
    'conversation_id', v_row.conversation_id, 'channel', v_row.channel,
    'expires_at', v_row.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_revoke_client_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_client_sessions SET revoked_at = now()
  WHERE id = p_session_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.ai_create_client_session(uuid,text,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_create_client_session(uuid,text,uuid,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ai_validate_client_session(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_validate_client_session(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION public.ai_revoke_client_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_revoke_client_session(uuid) TO service_role;

-- --------------------------------------------------------------------------
-- 10. SUNAT idempotency, lease-based retry and preservation of legacy XML
-- --------------------------------------------------------------------------

CREATE TABLE public.comprobante_xml_history (
  source_xml_id bigint PRIMARY KEY,
  comprobante_id bigint,
  xml text,
  hash text,
  xml_firmado text,
  zip bytea,
  archived_reason text NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.comprobante_xml_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comprobante_xml_history FROM PUBLIC, anon, authenticated;

WITH ranked AS (
  SELECT x.*, row_number() OVER (
    PARTITION BY comprobante_id ORDER BY id DESC
  ) AS rn
  FROM public.comprobante_xml x
  WHERE comprobante_id IS NOT NULL
), archived AS (
  INSERT INTO public.comprobante_xml_history(
    source_xml_id, comprobante_id, xml, hash, xml_firmado, zip, archived_reason
  )
  SELECT id, comprobante_id, xml, hash, xml_firmado, zip,
    'duplicate_before_unique_constraint'
  FROM ranked WHERE rn > 1
  ON CONFLICT (source_xml_id) DO NOTHING
  RETURNING source_xml_id
)
DELETE FROM public.comprobante_xml x
WHERE x.id IN (SELECT source_xml_id FROM archived);

CREATE UNIQUE INDEX uq_comprobante_xml_comprobante
  ON public.comprobante_xml(comprobante_id) WHERE comprobante_id IS NOT NULL;

ALTER TABLE public.comprobantes
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS lease_owner text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.comprobantes ADD CONSTRAINT comprobantes_retry_attempts_check
  CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 50);
CREATE UNIQUE INDEX uq_comprobantes_idempotency
  ON public.comprobantes(hotel_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_comprobantes_retry_queue
  ON public.comprobantes(estado, next_attempt_at, created_at)
  WHERE estado IN ('pendiente', 'rechazado', 'procesando');

CREATE OR REPLACE FUNCTION public.claim_facturacion_jobs(
  p_worker_id text, p_limit integer DEFAULT 10, p_lease_seconds integer DEFAULT 120
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_jobs jsonb;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF length(btrim(COALESCE(p_worker_id, ''))) NOT BETWEEN 8 AND 200
     OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'invalid claim parameters'; END IF;
  UPDATE public.comprobantes SET estado = CASE WHEN attempts >= max_attempts THEN 'fallido' ELSE 'pendiente' END,
    lease_owner = NULL, lease_expires_at = NULL,
    next_attempt_at = CASE WHEN attempts >= max_attempts THEN next_attempt_at ELSE now() END,
    last_error = COALESCE(last_error, 'lease_expired'), updated_at = now()
  WHERE estado = 'procesando' AND lease_expires_at <= now();
  WITH candidates AS (
    SELECT id FROM public.comprobantes
    WHERE estado IN ('pendiente', 'rechazado') AND next_attempt_at <= now()
      AND attempts < max_attempts
    ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50)
  ), claimed AS (
    UPDATE public.comprobantes c SET estado = 'procesando', lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempts = c.attempts + 1, updated_at = now()
    WHERE c.id IN (SELECT id FROM candidates) RETURNING c.*
  ) SELECT COALESCE(jsonb_agg(to_jsonb(claimed) ORDER BY created_at), '[]'::jsonb)
    INTO v_jobs FROM claimed;
  RETURN v_jobs;
END;
$$;

CREATE OR REPLACE FUNCTION public.ack_facturacion_job(
  p_comprobante_id bigint, p_worker_id text, p_estado text DEFAULT 'aceptado'
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' OR p_estado NOT IN ('aceptado', 'emitido') THEN
    RAISE EXCEPTION 'invalid facturacion acknowledgement';
  END IF;
  UPDATE public.comprobantes SET estado = p_estado, processed_at = now(),
    lease_owner = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = now()
  WHERE id = p_comprobante_id AND estado = 'procesando'
    AND lease_owner = p_worker_id AND lease_expires_at > now();
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.nack_facturacion_job(
  p_comprobante_id bigint, p_worker_id text, p_error text, p_permanent boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_rows integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.comprobantes SET
    estado = CASE WHEN p_permanent OR attempts >= max_attempts THEN 'fallido' ELSE 'rechazado' END,
    next_attempt_at = CASE WHEN p_permanent OR attempts >= max_attempts THEN next_attempt_at
      ELSE now() + make_interval(secs => LEAST(21600, (power(2, LEAST(attempts, 11)) * 30)::integer)) END,
    lease_owner = NULL, lease_expires_at = NULL,
    last_error = left(COALESCE(p_error, 'sunat_failed'), 4000), updated_at = now()
  WHERE id = p_comprobante_id AND estado = 'procesando' AND lease_owner = p_worker_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_facturacion_jobs(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_facturacion_jobs(text,integer,integer) TO service_role;
REVOKE ALL ON FUNCTION public.ack_facturacion_job(bigint,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_facturacion_job(bigint,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.nack_facturacion_job(bigint,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nack_facturacion_job(bigint,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_sale_fiscal_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_sale_status text;
BEGIN
  IF NEW.estado IS NOT DISTINCT FROM OLD.estado OR NEW.source_id IS NULL THEN RETURN NEW; END IF;
  v_sale_status := CASE NEW.estado
    WHEN 'aceptado' THEN 'sunat_emitido'
    WHEN 'emitido' THEN 'sunat_emitido'
    WHEN 'fallido' THEN 'sunat_error'
    ELSE 'sunat_pendiente'
  END;
  IF NEW.source_table = 'ventas' THEN
    UPDATE public.ventas SET estado_comprobante = v_sale_status WHERE id = NEW.source_id AND hotel_id = NEW.hotel_id;
  ELSIF NEW.source_table = 'ventas_pos' THEN
    UPDATE public.ventas_pos SET estado_comprobante = v_sale_status WHERE id = NEW.source_id AND hotel_id = NEW.hotel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sale_fiscal_status ON public.comprobantes;
CREATE TRIGGER trg_sync_sale_fiscal_status
AFTER UPDATE OF estado ON public.comprobantes
FOR EACH ROW EXECUTE FUNCTION public.sync_sale_fiscal_status();

REVOKE ALL ON FUNCTION public.sync_sale_fiscal_status() FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------------
-- 11. Least-privilege RLS: housekeeping never receives guest/fiscal/payment PII
-- --------------------------------------------------------------------------

DROP POLICY IF EXISTS "reservas_select" ON public.reservas;
DROP POLICY IF EXISTS "reservas_insert" ON public.reservas;
DROP POLICY IF EXISTS "reservas_update" ON public.reservas;
DROP POLICY IF EXISTS "reservas_delete" ON public.reservas;
CREATE POLICY reservas_operator_select ON public.reservas
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
REVOKE INSERT, UPDATE, DELETE ON public.reservas FROM authenticated;
GRANT SELECT ON public.reservas TO authenticated;

DROP VIEW IF EXISTS public.housekeeping_reservations;
CREATE VIEW public.housekeeping_reservations
WITH (security_barrier = true)
AS
SELECT r.id, r.hotel_id, r.habitacion_id, r.habitacion_numero, r.habitacion_tipo,
  r.estado, r.fecha_entrada, r.fecha_salida,
  CASE WHEN r.estado = 'activa' THEN 'ocupada'
       WHEN r.estado = 'finalizada' THEN 'limpieza'
       ELSE r.estado END AS housekeeping_status
FROM public.reservas r
WHERE public.is_user_active() AND public.get_user_role() = 'limpieza'
  AND r.hotel_id = public.get_user_hotel_id();
REVOKE ALL ON public.housekeeping_reservations FROM PUBLIC, anon;
GRANT SELECT ON public.housekeeping_reservations TO authenticated;

DROP POLICY IF EXISTS "ventas_select" ON public.ventas;
DROP POLICY IF EXISTS "ventas_insert" ON public.ventas;
DROP POLICY IF EXISTS "ventas_update" ON public.ventas;
DROP POLICY IF EXISTS "ventas_delete" ON public.ventas;
CREATE POLICY ventas_operator_select ON public.ventas
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
REVOKE INSERT, UPDATE, DELETE ON public.ventas FROM authenticated;
GRANT SELECT ON public.ventas TO authenticated;

DROP POLICY IF EXISTS "ventas_pos_select" ON public.ventas_pos;
CREATE POLICY ventas_pos_operator_select ON public.ventas_pos
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

DROP POLICY IF EXISTS "checkins_staff_select" ON public.checkins_publicos;
CREATE POLICY checkins_operator_select ON public.checkins_publicos
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

DROP POLICY IF EXISTS "loyalty_accounts_select_by_hotel" ON public.loyalty_accounts;
CREATE POLICY loyalty_accounts_operator_select ON public.loyalty_accounts
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
DROP POLICY IF EXISTS "loyalty_transactions_select_by_hotel" ON public.loyalty_transactions;
CREATE POLICY loyalty_transactions_operator_select ON public.loyalty_transactions
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

DROP POLICY IF EXISTS "comprobantes_select_by_hotel" ON public.comprobantes;
CREATE POLICY comprobantes_operator_select ON public.comprobantes
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
DROP POLICY IF EXISTS "comprobante_detalle_select_by_hotel" ON public.comprobante_detalle;
CREATE POLICY comprobante_detalle_operator_select ON public.comprobante_detalle
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND EXISTS (SELECT 1 FROM public.comprobantes c WHERE c.id = comprobante_id
      AND (public.get_user_role() = 'developer' OR c.hotel_id = public.get_user_hotel_id()))
  );
DROP POLICY IF EXISTS "comprobante_xml_select_by_hotel" ON public.comprobante_xml;
CREATE POLICY comprobante_xml_operator_select ON public.comprobante_xml
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND EXISTS (SELECT 1 FROM public.comprobantes c WHERE c.id = comprobante_id
      AND (public.get_user_role() = 'developer' OR c.hotel_id = public.get_user_hotel_id()))
  );
DROP POLICY IF EXISTS "sunat_envios_select_by_hotel" ON public.sunat_envios;
CREATE POLICY sunat_envios_operator_select ON public.sunat_envios
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND EXISTS (SELECT 1 FROM public.comprobantes c WHERE c.id = comprobante_id
      AND (public.get_user_role() = 'developer' OR c.hotel_id = public.get_user_hotel_id()))
  );
DROP POLICY IF EXISTS "cdr_select_by_hotel" ON public.cdr;
CREATE POLICY cdr_operator_select ON public.cdr
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND EXISTS (SELECT 1 FROM public.comprobantes c WHERE c.id = comprobante_id
      AND (public.get_user_role() = 'developer' OR c.hotel_id = public.get_user_hotel_id()))
  );

DROP POLICY IF EXISTS ai_conversations_operator_mutation ON public.ai_conversations;
DROP POLICY IF EXISTS ai_messages_operator_mutation ON public.ai_messages;
REVOKE INSERT, UPDATE, DELETE ON public.ai_conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_messages FROM authenticated;
GRANT SELECT ON public.ai_conversations, public.ai_messages TO authenticated;

DROP POLICY IF EXISTS ai_domain_events_staff ON public.ai_domain_events;
REVOKE ALL ON public.ai_domain_events FROM authenticated;

DROP POLICY IF EXISTS "Permitir lectura ai_hotel_config solo para staff" ON public.ai_hotel_config;
CREATE POLICY ai_hotel_config_active_operator_select ON public.ai_hotel_config
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );
DROP POLICY IF EXISTS "Permitir lectura ai_hotel_knowledge solo para staff" ON public.ai_hotel_knowledge;
CREATE POLICY ai_hotel_knowledge_active_operator_select ON public.ai_hotel_knowledge
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND public.get_user_role() IN ('recepcionista', 'admin', 'developer')
    AND (public.get_user_role() = 'developer' OR hotel_id = public.get_user_hotel_id())
  );

-- Channel state/health is server-owned. Administrators use a constrained RPC;
-- they cannot forge a successful healthcheck through PostgREST.
REVOKE INSERT, UPDATE, DELETE ON public.ai_channel_connections FROM authenticated;
GRANT SELECT ON public.ai_channel_connections TO authenticated;

CREATE OR REPLACE FUNCTION public.ai_upsert_channel_connection(
  p_hotel_id uuid, p_channel text, p_name text, p_external_account_id text,
  p_enabled boolean, p_response_delay_seconds integer,
  p_max_concurrent_messages integer, p_public_config jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_role text := public.get_user_role(); v_row public.ai_channel_connections%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_user_active() OR v_role NOT IN ('admin', 'developer') THEN
    RAISE EXCEPTION 'administrator role required';
  END IF;
  IF v_role <> 'developer' AND p_hotel_id <> public.get_user_hotel_id() THEN
    RAISE EXCEPTION 'hotel mismatch';
  END IF;
  IF p_channel NOT IN ('web', 'whatsapp', 'instagram', 'facebook', 'guest_portal')
     OR length(btrim(COALESCE(p_name, ''))) NOT BETWEEN 2 AND 100
     OR p_response_delay_seconds NOT BETWEEN 0 AND 120
     OR p_max_concurrent_messages NOT BETWEEN 1 AND 50
     OR (p_channel <> 'web' AND length(btrim(COALESCE(p_external_account_id, ''))) NOT BETWEEN 1 AND 200) THEN
    RAISE EXCEPTION 'invalid channel configuration';
  END IF;
  SELECT * INTO v_row FROM public.ai_channel_connections
  WHERE hotel_id = p_hotel_id AND channel = p_channel
  ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF p_enabled AND p_channel <> 'web' AND (v_row.credential_id IS NULL OR v_row.revoked_at IS NOT NULL
       OR v_row.status NOT IN ('connected', 'degraded') OR v_row.last_healthcheck_at IS NULL
       OR v_row.last_healthcheck_at < now() - interval '10 minutes') THEN
      RAISE EXCEPTION 'recent signed connector healthcheck required before activation';
    END IF;
    UPDATE public.ai_channel_connections SET name = btrim(p_name),
      external_account_id = NULLIF(btrim(p_external_account_id), ''), enabled = p_enabled,
      response_delay_seconds = p_response_delay_seconds,
      max_concurrent_messages = p_max_concurrent_messages,
      public_config = COALESCE(p_public_config, '{}'::jsonb), updated_at = now()
    WHERE id = v_row.id RETURNING * INTO v_row;
  ELSE
    IF p_enabled AND p_channel <> 'web' THEN RAISE EXCEPTION 'provision and healthcheck channel before activation'; END IF;
    INSERT INTO public.ai_channel_connections(
      hotel_id, channel, name, external_account_id, enabled,
      response_delay_seconds, max_concurrent_messages, public_config
    ) VALUES (
      p_hotel_id, p_channel, btrim(p_name), NULLIF(btrim(p_external_account_id), ''),
      CASE WHEN p_channel = 'web' THEN p_enabled ELSE false END,
      p_response_delay_seconds, p_max_concurrent_messages, COALESCE(p_public_config, '{}'::jsonb)
    ) RETURNING * INTO v_row;
  END IF;
  RETURN to_jsonb(v_row) - 'last_error';
END;
$$;

REVOKE ALL ON FUNCTION public.ai_upsert_channel_connection(uuid,text,text,text,boolean,integer,integer,jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_upsert_channel_connection(uuid,text,text,text,boolean,integer,integer,jsonb)
  TO authenticated;

-- --------------------------------------------------------------------------
-- 12. Expiration, queue reaper and privacy retention (never deletes audit/fiscal)
-- --------------------------------------------------------------------------

ALTER TABLE public.ai_hotel_config
  ADD COLUMN IF NOT EXISTS data_retention_days integer NOT NULL DEFAULT 365
    CHECK (data_retention_days BETWEEN 30 AND 3650);

CREATE OR REPLACE FUNCTION public.ai_expire_booking_artifacts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE v_quotes integer; v_holds integer; v_payments integer;
  v_messages integer; v_events integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  UPDATE public.ai_quotes SET status = 'expired'
  WHERE status = 'pending' AND expires_at <= now();
  GET DIAGNOSTICS v_quotes = ROW_COUNT;
  UPDATE public.ai_reservation_holds SET status = 'expired', updated_at = now()
  WHERE status IN ('active', 'payment_pending') AND expires_at <= now();
  GET DIAGNOSTICS v_holds = ROW_COUNT;
  UPDATE public.ai_payment_intents SET status = 'expired', updated_at = now()
  WHERE status IN ('created', 'pending', 'awaiting_manual_review') AND expires_at <= now();
  GET DIAGNOSTICS v_payments = ROW_COUNT;
  UPDATE public.ai_messages SET
    delivery_status = CASE WHEN delivery_attempts >= max_delivery_attempts THEN 'dead_letter' ELSE 'queued' END,
    dead_letter_at = CASE WHEN delivery_attempts >= max_delivery_attempts THEN now() ELSE dead_letter_at END,
    lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = now(),
    error_code = COALESCE(error_code, 'lease_expired')
  WHERE delivery_status = 'processing' AND lease_expires_at <= now();
  GET DIAGNOSTICS v_messages = ROW_COUNT;
  UPDATE public.ai_domain_events SET
    status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'pending' END,
    dead_letter_at = CASE WHEN attempts >= max_attempts THEN now() ELSE dead_letter_at END,
    lease_owner = NULL, lease_expires_at = NULL, next_attempt_at = now(),
    last_error = COALESCE(last_error, 'lease_expired')
  WHERE status = 'processing' AND lease_expires_at <= now();
  GET DIAGNOSTICS v_events = ROW_COUNT;
  RETURN jsonb_build_object('quotes', v_quotes, 'holds', v_holds, 'payments', v_payments,
    'requeued_messages', v_messages, 'requeued_events', v_events);
END;
$$;

CREATE OR REPLACE FUNCTION public.ai_retention_maintenance()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
DECLARE v_nonces integer; v_tokens integer; v_events integer; v_messages integer;
  v_sessions integer; v_contacts integer; v_conversations integer; v_payment_payloads integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  DELETE FROM private.ai_channel_nonces WHERE expires_at < now() - interval '1 day';
  GET DIAGNOSTICS v_nonces = ROW_COUNT;
  DELETE FROM public.guest_access_tokens
  WHERE expires_at < now() - interval '30 days'
     OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '30 days');
  GET DIAGNOSTICS v_tokens = ROW_COUNT;
  DELETE FROM public.ai_domain_events
  WHERE (status = 'published' AND published_at < now() - interval '30 days')
     OR (status = 'dead_letter' AND dead_letter_at < now() - interval '180 days');
  GET DIAGNOSTICS v_events = ROW_COUNT;
  DELETE FROM public.ai_messages
  WHERE delivery_status = 'dead_letter' AND dead_letter_at < now() - interval '180 days';
  GET DIAGNOSTICS v_messages = ROW_COUNT;
  DELETE FROM public.ai_client_sessions
  WHERE expires_at < now() - interval '7 days'
     OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days');
  GET DIAGNOSTICS v_sessions = ROW_COUNT;
  UPDATE public.ai_channel_contacts c SET guest_name = NULL, guest_phone = NULL,
    guest_email = NULL, metadata = '{}'::jsonb
  WHERE last_seen_at < now() - make_interval(days => COALESCE((
    SELECT data_retention_days FROM public.ai_hotel_config cfg WHERE cfg.hotel_id = c.hotel_id
  ), 365)) AND (guest_name IS NOT NULL OR guest_phone IS NOT NULL OR guest_email IS NOT NULL OR metadata <> '{}'::jsonb);
  GET DIAGNOSTICS v_contacts = ROW_COUNT;
  UPDATE public.ai_conversations c SET guest_name = NULL, guest_phone = NULL,
    guest_email = NULL, metadata = metadata - 'document' - 'dni' - 'email' - 'phone'
  WHERE status IN ('closed', 'abandoned')
    AND updated_at < now() - make_interval(days => COALESCE((
      SELECT data_retention_days FROM public.ai_hotel_config cfg WHERE cfg.hotel_id = c.hotel_id
    ), 365));
  GET DIAGNOSTICS v_conversations = ROW_COUNT;
  UPDATE public.ai_payment_events e SET payload = jsonb_build_object(
    'redacted', true, 'event_type', event_type, 'redacted_at', now())
  WHERE processed_at < now() - interval '365 days'
    AND COALESCE(payload->>'redacted', 'false') <> 'true';
  GET DIAGNOSTICS v_payment_payloads = ROW_COUNT;
  RETURN jsonb_build_object('nonces', v_nonces, 'guest_tokens', v_tokens,
    'domain_events', v_events, 'dead_letter_messages', v_messages,
    'client_sessions', v_sessions, 'redacted_contacts', v_contacts,
    'redacted_conversations', v_conversations, 'redacted_payment_payloads', v_payment_payloads,
    'audit_deleted', 0, 'fiscal_deleted', 0);
END;
$$;

REVOKE ALL ON FUNCTION public.ai_expire_booking_artifacts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_expire_booking_artifacts() TO service_role;
REVOKE ALL ON FUNCTION public.ai_retention_maintenance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_retention_maintenance() TO service_role;

-- Private evidence objects are written only by trusted Edge dispatchers. No
-- browser storage policy is created, so anon/authenticated cannot enumerate or
-- replace payment proofs directly.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

NOTIFY pgrst, 'reload schema';
