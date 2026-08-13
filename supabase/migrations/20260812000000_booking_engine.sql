-- 📂 MIGRACIÓN: Motor de Reservas Directo
-- Path: supabase/migrations/20260812000000_booking_engine.sql

DO $$ 
BEGIN 
  -- Añadir columna 'origen' a reservas si no existe (para diferenciar Motor Directo, Recepción, Booking, etc)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservas' AND column_name='origen') THEN
    ALTER TABLE reservas ADD COLUMN origen text DEFAULT 'recepcion';
  END IF;

  -- Añadir columna 'servicios_extra_ids' a reservas para almacenar extras comprados durante la reserva
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservas' AND column_name='servicios_extra_ids') THEN
    ALTER TABLE reservas ADD COLUMN servicios_extra_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
