-- Contract smoke tests for 20260824000001_full_audit_remediation.sql.
-- Run after all migrations with: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>

BEGIN;

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(expected.signature ORDER BY expected.signature)
  INTO v_missing
  FROM (VALUES
    ('public.checkout_reserva_atomic(uuid,uuid,uuid,jsonb,jsonb)'),
    ('public.create_public_booking_checkout(uuid,text,text,uuid,date,date,integer,integer,text,text,text,text,text,text)'),
    ('public.submit_public_checkin_atomic(text,jsonb)'),
    ('public.get_public_checkin_context(text)'),
    ('public.ai_claim_channel_messages_v2(uuid,text,text,text,integer,integer)'),
    ('public.ai_ack_channel_message(uuid,text,text)'),
    ('public.ai_nack_channel_message(uuid,text,text,boolean)'),
    ('public.ai_claim_domain_events(uuid,text,integer,integer)'),
    ('public.ai_claim_domain_events_v2(uuid,text,text,text,integer,integer)'),
    ('public.ai_ack_domain_event(uuid,text)'),
    ('public.ai_nack_domain_event(uuid,text,text,boolean)'),
    ('public.ai_rotate_guest_access_tokens(uuid)'),
    ('public.ai_enqueue_precheckin_delivery(uuid,uuid)'),
    ('public.ai_verify_manual_payment(uuid,text,jsonb)'),
    ('public.ai_reconcile_payment(uuid,text,text,uuid)'),
    ('public.staff_search_availability(uuid,date,date,integer,integer)'),
    ('public.ai_send_human_message(uuid,text)'),
    ('public.ai_release_conversation(uuid)'),
    ('public.ai_store_channel_credential(uuid,text,text,integer)'),
    ('public.ai_upsert_channel_connection(uuid,text,text,text,boolean,integer,integer,jsonb)'),
    ('public.ai_get_channel_credential(text)'),
    ('public.ai_consume_channel_nonce(text,text,timestamp with time zone)'),
    ('public.ai_retention_maintenance()')
  ) AS expected(signature)
  WHERE to_regprocedure(expected.signature) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'missing remediation RPCs: %', v_missing;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_sync_sale_fiscal_status'
      AND tgrelid = 'public.comprobantes'::regclass
      AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'sale fiscal status synchronization trigger is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'payment-proofs' AND name = 'payment-proofs' AND public = false
  ) THEN RAISE EXCEPTION 'private payment evidence bucket is missing'; END IF;

  IF has_table_privilege('authenticated', 'public.ai_channel_connections', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ai_channel_connections', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.ai_channel_connections', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated still has direct channel connection mutation privileges';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_ventas_reserva'
  ) THEN RAISE EXCEPTION 'one-sale-per-reservation index is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ai_messages'::regclass
      AND conname = 'fk_ai_messages_conversation_hotel'
  ) THEN RAISE EXCEPTION 'tenant-safe AI message FK is missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'uq_comprobante_xml_comprobante'
  ) THEN RAISE EXCEPTION 'one-XML-per-comprobante index is missing'; END IF;

  IF has_function_privilege('anon',
      'public.create_public_booking_checkout(uuid,text,text,uuid,date,date,integer,integer,text,text,text,text,text,text)',
      'EXECUTE') THEN
    RAISE EXCEPTION 'anonymous role can execute public booking mutation RPC';
  END IF;

  IF has_function_privilege('authenticated',
      'public.ai_rotate_guest_access_tokens(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated role can extract raw guest tokens';
  END IF;

  IF has_function_privilege('authenticated',
      'public.generate_reservation_tokens(uuid)', 'EXECUTE')
     OR has_function_privilege('service_role',
      'public.generate_reservation_tokens(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'legacy raw-token RPC remains executable';
  END IF;

  IF has_table_privilege('authenticated', 'public.ai_messages', 'INSERT')
     OR has_table_privilege('authenticated', 'public.ai_conversations', 'UPDATE') THEN
    RAISE EXCEPTION 'dangerous direct AI mutations remain granted';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ai_domain_events
    WHERE payload ? 'portal_token' OR payload ? 'checkin_token'
  ) THEN RAISE EXCEPTION 'raw guest token remains in outbox payload'; END IF;
END;
$$;

-- Append-only triggers must be present on both server and legacy audit tables.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_events'::regclass
      AND tgname = 'trg_audit_events_append_only' AND NOT tgisinternal
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.audit_logs'::regclass
      AND tgname = 'trg_audit_logs_append_only' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'append-only audit trigger missing'; END IF;
END;
$$;

ROLLBACK;
