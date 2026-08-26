-- Configuración de Cron Jobs para Supabase Edge Functions usando pg_cron y pg_net

-- 1. Asegurar que las extensiones necesarias estén habilitadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. (Saltado: Limpieza no necesaria en la primera creación)

-- 3. Programar Job: expire-ai-booking-artifacts (Cada minuto)
SELECT cron.schedule(
  'expire-ai-booking-artifacts',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/expire-ai-booking-artifacts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- 4. Programar Job: facturacion-worker (Cada minuto)
SELECT cron.schedule(
  'facturacion-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/facturacion-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);

-- 5. Programar Job: expire-loyalty-points (Diario a las 00:00)
SELECT cron.schedule(
  'expire-loyalty-points',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/expire-loyalty-points',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'),
        'Content-Type', 'application/json'
      )
    );
  $$
);
