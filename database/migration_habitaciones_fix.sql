-- ============================================================
-- MIGRACIÓN: Alinear tabla habitaciones con el código React
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Agregar columna precio_noche (alias de precio para compatibilidad)
ALTER TABLE habitaciones 
  ADD COLUMN IF NOT EXISTS precio_noche numeric DEFAULT 80;

-- 2. Agregar columna capacidad (personas por habitación)
ALTER TABLE habitaciones 
  ADD COLUMN IF NOT EXISTS capacidad integer DEFAULT 1;

-- 3. Sincronizar precio_noche con el valor actual de precio
UPDATE habitaciones 
  SET precio_noche = precio 
  WHERE precio_noche IS NULL OR precio_noche = 0;

-- 4. Verificar resultado
SELECT id, numero, tipo, precio, precio_noche, capacidad, estado 
FROM habitaciones 
LIMIT 20;
