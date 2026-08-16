-- Align the hoteles schema with the management panels and seed data.
-- Existing installations may predate the activo flag.

ALTER TABLE public.hoteles
  ADD COLUMN IF NOT EXISTS activo boolean;

UPDATE public.hoteles
SET activo = true
WHERE activo IS NULL;

ALTER TABLE public.hoteles
  ALTER COLUMN activo SET DEFAULT true,
  ALTER COLUMN activo SET NOT NULL;

COMMENT ON COLUMN public.hoteles.activo IS
  'Controls whether the tenant is operational without deleting its historical data.';

-- Ask PostgREST to refresh its schema cache immediately after deployment.
NOTIFY pgrst, 'reload schema';
