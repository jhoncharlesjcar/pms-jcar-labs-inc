-- 📂 MIGRACIÓN: Agregar Tipo de Cambio a la tabla de Hoteles
-- Ejecuta este script en el editor SQL de Supabase para habilitar soporte Multi-Moneda.

ALTER TABLE hoteles ADD COLUMN IF NOT EXISTS tipo_cambio numeric DEFAULT 3.80;
