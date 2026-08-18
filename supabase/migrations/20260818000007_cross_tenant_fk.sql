-- ============================================================
-- P1 FIX: Cross-Tenant Composite Foreign Key (Hotel + Habitación)
-- Ensures that a reservation cannot reference a room belonging to another hotel.
-- Path: supabase/migrations/20260818000007_cross_tenant_fk.sql
-- ============================================================

-- 1. Ensure composite unique constraint on habitaciones(id, hotel_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.habitaciones'::regclass
      AND conname = 'uq_habitacion_hotel'
  ) THEN
    ALTER TABLE public.habitaciones
      ADD CONSTRAINT uq_habitacion_hotel UNIQUE (id, hotel_id);
  END IF;
END $$;

-- 2. Ensure composite foreign key on reservas(habitacion_id, hotel_id) -> habitaciones(id, hotel_id)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.reservas'::regclass
      AND conname = 'fk_reserva_habitacion_hotel'
  ) THEN
    ALTER TABLE public.reservas
      ADD CONSTRAINT fk_reserva_habitacion_hotel
      FOREIGN KEY (habitacion_id, hotel_id)
      REFERENCES public.habitaciones(id, hotel_id)
      ON DELETE SET NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
