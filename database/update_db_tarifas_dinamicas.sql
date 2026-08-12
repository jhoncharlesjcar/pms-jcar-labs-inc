-- 📂 MIGRACIÓN: Crear Tabla para Sistema de Tarifas Dinámicas
-- Copia y ejecuta este script en el editor SQL de tu Supabase Dashboard.

CREATE TABLE IF NOT EXISTS tarifas_dinamicas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  tipo            text NOT NULL, -- 'temporada' | 'dia_semana'
  fecha_inicio    text,          -- Formato 'yyyy-MM-dd' para temporadas
  fecha_fin       text,          -- Formato 'yyyy-MM-dd' para temporadas
  dias_semana     integer[],     -- Array de números (0: Dom, 1: Lun, ..., 6: Sáb)
  habitacion_tipo text DEFAULT 'todos', -- 'simple', 'doble', 'matrimonial', 'todos'
  factor_ajuste   numeric NOT NULL DEFAULT 1.0, -- Multiplicador, ej: 1.15 para +15%
  activo          boolean NOT NULL DEFAULT true, -- Activar/desactivar tarifa
  created_date    timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE tarifas_dinamicas ENABLE ROW LEVEL SECURITY;

-- Permitir lectura únicamente para el staff autenticado del hotel
CREATE POLICY "Permitir lectura solo para staff autenticado" ON tarifas_dinamicas
  FOR SELECT TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

-- Permitir inserción, actualización y eliminación al staff autenticado del hotel
CREATE POLICY "Permitir insercion para staff autenticado" ON tarifas_dinamicas
  FOR INSERT TO authenticated WITH CHECK (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Permitir actualizacion para staff autenticado" ON tarifas_dinamicas
  FOR UPDATE TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  ) WITH CHECK (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Permitir eliminacion para staff autenticado" ON tarifas_dinamicas
  FOR DELETE TO authenticated USING (
    hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
  );
