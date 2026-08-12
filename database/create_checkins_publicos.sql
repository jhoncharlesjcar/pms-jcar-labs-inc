-- 📂 MIGRACIÓN: Crear Tabla para Check-in Digital Público (pre-registro)
-- Copia y ejecuta este script en el editor SQL de tu Supabase Dashboard.

CREATE TABLE IF NOT EXISTS checkins_publicos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id                 uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  huesped_nombre           text NOT NULL,
  huesped_dni              text NOT NULL,
  tipo_documento           text DEFAULT 'DNI',
  huesped_sexo             text DEFAULT 'no_especificado',
  huesped_fecha_nacimiento text,
  huesped_telefono         text,
  huesped_email            text,
  huesped_pais_residencia  text DEFAULT 'Perú',
  huesped_ciudad_residencia text,
  nacionalidad             text DEFAULT 'Peruana',
  motivo_viaje             text DEFAULT 'turismo',
  fecha_entrada            text NOT NULL,
  fecha_salida             text NOT NULL,
  num_adultos              integer DEFAULT 1,
  num_ninos                integer DEFAULT 0,
  tiene_menores            boolean DEFAULT false,
  tipo_relacion_menor      text DEFAULT 'padre',
  observaciones            text,
  created_date             timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE checkins_publicos ENABLE ROW LEVEL SECURITY;

-- Permitir inserción anónima (cualquier persona externa escaneando el QR puede registrarse)
CREATE POLICY "Permitir insercion publica anonima" ON checkins_publicos
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Permitir insercion autenticada" ON checkins_publicos
  FOR INSERT TO authenticated WITH CHECK (true);

-- Permitir lectura únicamente para el staff autenticado del hotel
CREATE POLICY "Permitir lectura solo para staff" ON checkins_publicos
  FOR SELECT TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );
