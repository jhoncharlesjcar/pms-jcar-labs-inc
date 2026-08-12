-- 📂 MIGRACIÓN: Channel Manager (Fase 1) y Yield Management
-- Copia y ejecuta este script en el editor SQL de tu Supabase Dashboard.

-- 1. Tabla de Configuración de Canales (OTAs)
CREATE TABLE IF NOT EXISTS ota_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  ota_name text NOT NULL, -- 'booking', 'despegar'
  api_key text,
  hotel_code_ota text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(hotel_id, ota_name)
);

-- Habilitar RLS en ota_config
ALTER TABLE ota_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ota_config solo para staff" ON ota_config
  FOR SELECT TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Permitir mutaciones ota_config para staff" ON ota_config
  FOR ALL TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  ) WITH CHECK (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

-- 2. Tabla de Mapeo de Habitaciones (PMS vs OTA)
CREATE TABLE IF NOT EXISTS ota_room_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  ota_name text NOT NULL, -- 'booking', 'despegar'
  pms_room_type text NOT NULL, -- 'simple', 'doble', etc. (del PMS)
  ota_room_id text NOT NULL, -- Ej: 'room_12345'
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(hotel_id, ota_name, pms_room_type)
);

-- Habilitar RLS en ota_room_mappings
ALTER TABLE ota_room_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ota_room_mappings solo para staff" ON ota_room_mappings
  FOR SELECT TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Permitir mutaciones ota_room_mappings para staff" ON ota_room_mappings
  FOR ALL TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  ) WITH CHECK (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

-- 3. Actualizar tabla `tarifas_dinamicas` para Yield por Ocupación
DO $$ 
BEGIN 
  -- Añadir umbral_ocupacion_min si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tarifas_dinamicas' AND column_name='umbral_ocupacion_min') THEN
    ALTER TABLE tarifas_dinamicas ADD COLUMN umbral_ocupacion_min integer;
  END IF;
END $$;
