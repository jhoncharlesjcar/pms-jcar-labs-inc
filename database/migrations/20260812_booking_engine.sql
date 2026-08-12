-- 📂 MIGRACIÓN: Motor de Reservas (Sprint 4)
-- Copia y ejecuta este script en el editor SQL de tu Supabase Dashboard.

DO $$ 
BEGIN 
  -- Añadir columna 'origen' a reservas si no existe (para diferenciar Motor Directo, Recepcion, Booking, etc)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservas' AND column_name='origen') THEN
    ALTER TABLE reservas ADD COLUMN origen text DEFAULT 'recepcion';
  END IF;

  -- Añadir columna 'servicios_extra_ids' a reservas para almacenar extras comprados durante la reserva
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reservas' AND column_name='servicios_extra_ids') THEN
    ALTER TABLE reservas ADD COLUMN servicios_extra_ids jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
