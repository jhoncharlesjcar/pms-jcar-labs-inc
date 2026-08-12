-- ==========================================
-- PMS JCAR LABS
-- Actualización para Ficha DIRCETUR
-- ==========================================

-- Agregar columnas necesarias para el registro de huéspedes según DIRCETUR
ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS huesped_sexo text DEFAULT 'no_especificado',
ADD COLUMN IF NOT EXISTS huesped_pais_residencia text DEFAULT 'Perú',
ADD COLUMN IF NOT EXISTS huesped_ciudad_residencia text,
ADD COLUMN IF NOT EXISTS huesped_email text,
ADD COLUMN IF NOT EXISTS tipo_documento text DEFAULT 'DNI';
