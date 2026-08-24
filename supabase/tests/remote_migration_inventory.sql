-- Read-only inventory for Supabase projects that do not yet have
-- supabase_migrations.schema_migrations. Safe to run in SQL Editor.

WITH checks(stage, required_object, present) AS (
  VALUES
    ('baseline', 'public.hoteles', to_regclass('public.hoteles') IS NOT NULL),
    ('baseline', 'public.usuarios', to_regclass('public.usuarios') IS NOT NULL),
    ('baseline', 'public.habitaciones', to_regclass('public.habitaciones') IS NOT NULL),
    ('baseline', 'public.reservas', to_regclass('public.reservas') IS NOT NULL),
    ('baseline', 'public.ventas', to_regclass('public.ventas') IS NOT NULL),
    ('facturacion', 'public.comprobantes', to_regclass('public.comprobantes') IS NOT NULL),
    ('loyalty', 'public.loyalty_accounts', to_regclass('public.loyalty_accounts') IS NOT NULL),
    ('jcar_ai_base', 'public.ai_hotel_config', to_regclass('public.ai_hotel_config') IS NOT NULL),
    ('jcar_ai_base', 'public.ai_conversations', to_regclass('public.ai_conversations') IS NOT NULL),
    ('jcar_ai_base', 'public.ai_messages', to_regclass('public.ai_messages') IS NOT NULL),
    ('jcar_ai_base', 'public.ai_quotes', to_regclass('public.ai_quotes') IS NOT NULL),
    ('jcar_ai_lifecycle', 'public.ai_channel_connections', to_regclass('public.ai_channel_connections') IS NOT NULL),
    ('jcar_ai_lifecycle', 'public.ai_booking_intents', to_regclass('public.ai_booking_intents') IS NOT NULL),
    ('jcar_ai_lifecycle', 'public.ai_reservation_holds', to_regclass('public.ai_reservation_holds') IS NOT NULL),
    ('jcar_ai_lifecycle', 'public.ai_payment_intents', to_regclass('public.ai_payment_intents') IS NOT NULL),
    ('audit_remediation', 'public.audit_events', to_regclass('public.audit_events') IS NOT NULL),
    ('audit_remediation', 'public.ai_client_sessions', to_regclass('public.ai_client_sessions') IS NOT NULL),
    ('audit_remediation', 'public.ai_manual_payment_evidence', to_regclass('public.ai_manual_payment_evidence') IS NOT NULL),
    ('audit_remediation', 'public.comprobante_xml_history', to_regclass('public.comprobante_xml_history') IS NOT NULL)
)
SELECT stage, required_object, present
FROM checks
ORDER BY
  CASE stage
    WHEN 'baseline' THEN 1
    WHEN 'facturacion' THEN 2
    WHEN 'loyalty' THEN 3
    WHEN 'jcar_ai_base' THEN 4
    WHEN 'jcar_ai_lifecycle' THEN 5
    WHEN 'audit_remediation' THEN 6
    ELSE 7
  END,
  required_object;

SELECT
  EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'supabase_migrations') AS migration_schema_exists,
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_exists,
  current_database() AS database_name,
  current_user AS database_user;
