-- supabase/migrations/20260907000001_fix_cron_auth_headers.sql
-- Fix F-02: Los cron jobs deben enviar X-Cron-Secret, no Authorization Bearer

-- Eliminar jobs existentes de forma segura
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) 
  FROM cron.job 
  WHERE jobname IN ('facturacion-worker', 'expire-ai-booking-artifacts', 'expire-loyalty-points');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Reprogramar con X-Cron-Secret
SELECT cron.schedule(
  'facturacion-worker',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/facturacion-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      )
    );
  $$
);

SELECT cron.schedule(
  'expire-ai-booking-artifacts',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/expire-ai-booking-artifacts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      )
    );
  $$
);

SELECT cron.schedule(
  'expire-loyalty-points',
  '0 0 * * *',
  $$
    SELECT net.http_post(
      url := 'https://nwprnycqplnmztpjicea.supabase.co/functions/v1/expire-loyalty-points',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
      )
    );
  $$
);
