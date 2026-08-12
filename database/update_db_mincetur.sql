-- ==========================================
-- PMS JCAR LABS — SPRINT 1
-- Actualización para Ficha MINCETUR
-- ==========================================

-- Agregar columnas necesarias para el registro de huéspedes según MINCETUR
ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS huesped_fecha_nacimiento date,
ADD COLUMN IF NOT EXISTS huesped_profesion text,
ADD COLUMN IF NOT EXISTS huesped_estado_civil text,
ADD COLUMN IF NOT EXISTS huesped_destino text;
