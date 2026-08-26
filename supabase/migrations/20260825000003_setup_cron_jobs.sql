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
      url := current_setting('app.settings.edge_api_url', true) || '/expire-ai-booking-artifacts',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
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
      url := current_setting('app.settings.edge_api_url', true) || '/facturacion-worker',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
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
      url := current_setting('app.settings.edge_api_url', true) || '/expire-loyalty-points',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
        'Content-Type', 'application/json'
      )
    );
  $$
);
