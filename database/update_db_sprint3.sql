-- Añadir columna para número de Yape/Plin en la configuración del hotel (tabla: hoteles)
ALTER TABLE hoteles ADD COLUMN IF NOT EXISTS numero_yape TEXT;
