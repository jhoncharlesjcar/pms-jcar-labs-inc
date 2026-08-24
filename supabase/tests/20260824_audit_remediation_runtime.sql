-- Transactional runtime smoke test for critical remediation flows.
-- Requires bootstrap_local_postgres.sql and all migrations.

BEGIN;

INSERT INTO public.hoteles(id, nombre, activo, modo_automatico, pasarela_activa)
VALUES ('10000000-0000-0000-0000-000000000001', 'Audit Test Hotel', true, false, 'manual');
INSERT INTO auth.users(id, email) VALUES
  ('20000000-0000-0000-0000-000000000001', 'admin@test.local'),
  ('20000000-0000-0000-0000-000000000002', 'clean@test.local');
INSERT INTO public.usuarios(id, email, full_name, role, hotel_id, activo, permissions)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'admin@test.local', 'Admin Test', 'admin',
    '10000000-0000-0000-0000-000000000001', true, '{"verify_manual_payments":true}'),
  ('20000000-0000-0000-0000-000000000002', 'clean@test.local', 'Clean Test', 'limpieza',
    '10000000-0000-0000-0000-000000000001', true, '{}');
INSERT INTO public.ai_hotel_config(hotel_id, agent_enabled, deposit_type, deposit_value)
VALUES ('10000000-0000-0000-0000-000000000001', true, 'full', 100);
INSERT INTO public.habitaciones(id, hotel_id, numero, tipo, precio_noche, capacidad, estado)
VALUES
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '101', 'simple', 50, 2, 'disponible'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001',
    '102', 'matrimonial', 90, 2, 'disponible');

SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);

DO $$
DECLARE
  v_reservation public.reservas%ROWTYPE;
  v_checkout jsonb;
  v_checkout_retry jsonb;
  v_public jsonb;
  v_payment_id uuid;
  v_payment_amount numeric;
  v_evidence_id uuid;
  v_confirmed_id uuid;
  v_tokens jsonb;
BEGIN
  v_reservation := public.create_reservation_atomic(
    p_hotel_id => '10000000-0000-0000-0000-000000000001',
    p_habitacion_id => '30000000-0000-0000-0000-000000000001',
    p_habitacion_numero => 'client-value-ignored', p_habitacion_tipo => 'client-value-ignored',
    p_huesped_nombre => 'Huésped Checkout', p_huesped_dni => '12345678',
    p_fecha_entrada => CURRENT_DATE, p_fecha_salida => CURRENT_DATE + 1,
    p_noches => 1, p_precio_noche => 50, p_total => 50, p_estado => 'activa',
    p_tipo_documento => 'DNI'
  );
  v_checkout := public.checkout_reserva_atomic(
    v_reservation.id, v_reservation.hotel_id,
    '20000000-0000-0000-0000-000000000001',
    '{"metodo_pago":"efectivo","descuento":0,"total":50,"idempotency_key":"checkout-test-0001"}',
    '{"earn":true}'
  );
  v_checkout_retry := public.checkout_reserva_atomic(
    v_reservation.id, v_reservation.hotel_id,
    '20000000-0000-0000-0000-000000000001',
    '{"metodo_pago":"efectivo","descuento":0,"total":50,"idempotency_key":"checkout-test-0001"}',
    '{"earn":true}'
  );
  IF NOT (v_checkout->>'success')::boolean
     OR NOT (v_checkout_retry->>'idempotent')::boolean
     OR (SELECT count(*) FROM public.ventas WHERE reserva_id = v_reservation.id) <> 1 THEN
    RAISE EXCEPTION 'atomic checkout/idempotency failed';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_public := public.create_public_booking_checkout(
    '10000000-0000-0000-0000-000000000001', 'public-session-000001',
    'public-idempotency-000001', '30000000-0000-0000-0000-000000000002',
    CURRENT_DATE + 2, CURRENT_DATE + 3, 2, 0,
    'Huésped Público', '999888777', 'ABCD1234', NULL, 'Pasaporte', 'yape'
  );
  v_payment_id := (v_public #>> '{payment,id}')::uuid;
  SELECT amount INTO v_payment_amount FROM public.ai_payment_intents WHERE id = v_payment_id;
  IF EXISTS (
    SELECT 1 FROM public.reservas WHERE habitacion_id = '30000000-0000-0000-0000-000000000002'
  ) THEN RAISE EXCEPTION 'public checkout created reservation before payment'; END IF;

  v_evidence_id := public.ai_submit_manual_payment_evidence(v_payment_id,
    jsonb_build_object('object_path', 'payment-proofs/test/12345678.png',
      'content_sha256', repeat('a', 64), 'observed_amount', v_payment_amount,
      'observed_at', now(), 'submitted_by', 'guest'));
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
  v_confirmed_id := public.ai_verify_manual_payment(
    v_payment_id, 'YAPE-TEST-001', jsonb_build_object('evidence_id', v_evidence_id)
  );
  IF v_confirmed_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.reservas WHERE id = v_confirmed_id AND estado = 'confirmada'
  ) THEN RAISE EXCEPTION 'verified payment did not confirm reservation'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ai_domain_events
    WHERE payload ? 'portal_token' OR payload ? 'checkin_token'
  ) THEN RAISE EXCEPTION 'raw token leaked into outbox'; END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  v_tokens := public.ai_rotate_guest_access_tokens(v_confirmed_id);
  IF length(v_tokens->>'portal_token') < 32 OR length(v_tokens->>'checkin_token') < 32
     OR (SELECT count(*) FROM public.guest_access_tokens WHERE reservation_id = v_confirmed_id) <> 2 THEN
    RAISE EXCEPTION 'one-time guest token rotation failed';
  END IF;
END;
$$;

CREATE TEMP TABLE rls_probe(direct_reservations integer, housekeeping_rows integer);
GRANT SELECT, INSERT ON rls_probe TO authenticated;
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.role" = 'authenticated';
SET LOCAL "request.jwt.claim.sub" = '20000000-0000-0000-0000-000000000002';
INSERT INTO rls_probe
SELECT (SELECT count(*) FROM public.reservas),
       (SELECT count(*) FROM public.housekeeping_reservations);
RESET ROLE;

DO $$
DECLARE v_probe rls_probe%ROWTYPE;
BEGIN
  SELECT * INTO v_probe FROM rls_probe;
  IF v_probe.direct_reservations <> 0 OR v_probe.housekeeping_rows < 1 THEN
    RAISE EXCEPTION 'housekeeping RLS/PII projection failed: direct=%, safe=%',
      v_probe.direct_reservations, v_probe.housekeeping_rows;
  END IF;
END;
$$;

ROLLBACK;
