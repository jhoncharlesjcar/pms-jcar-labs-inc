-- supabase/migrations/20260907000002_unique_cierre_caja.sql
-- FI-01: Prevenir doble cierre de caja para el mismo hotel+fecha

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.cierres_caja'::regclass
      AND conname = 'uq_cierre_caja_hotel_fecha'
  ) THEN
    ALTER TABLE public.cierres_caja
      ADD CONSTRAINT uq_cierre_caja_hotel_fecha UNIQUE (hotel_id, fecha);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
