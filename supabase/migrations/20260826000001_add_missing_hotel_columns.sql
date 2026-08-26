-- Agrega columnas faltantes en la tabla hoteles que son requeridas por el frontend
ALTER TABLE public.hoteles
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS qr_yape_url TEXT,
ADD COLUMN IF NOT EXISTS qr_plin_url TEXT;
