-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: INSUMOS (LIMPIEZA / MANTENIMIENTO)
-- Ejecutar en Supabase SQL Editor
-- ==========================================

-- 1. Crear tabla de categorías de insumos
CREATE TABLE IF NOT EXISTS categorias_insumos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  created_date timestamp with time zone DEFAULT now(),
  UNIQUE(hotel_id, nombre)
);

-- 2. Crear tabla de insumos
CREATE TABLE IF NOT EXISTS insumos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id      uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  categoria_id  uuid REFERENCES categorias_insumos(id) ON DELETE SET NULL,
  nombre        text NOT NULL,
  stock         integer NOT NULL DEFAULT 0,
  unidad_medida text DEFAULT 'unidad',
  activo        boolean DEFAULT true,
  created_date  timestamp with time zone DEFAULT now()
);

-- 3. Crear tabla de movimientos de insumos
CREATE TABLE IF NOT EXISTS movimientos_insumos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  insumo_id      uuid REFERENCES insumos(id) ON DELETE CASCADE,
  tipo_movimiento text NOT NULL, -- 'entrada', 'salida'
  cantidad       integer NOT NULL,
  costo_total    numeric DEFAULT 0, -- Costo de la compra (para Egresos)
  motivo         text,
  usuario_nombre text,
  created_date   timestamp with time zone DEFAULT now()
);

-- 4. Habilitar RLS
ALTER TABLE categorias_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_insumos ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de aislamiento por tenant (hotel_id)
DROP POLICY IF EXISTS "Aislamiento tenant categorias_insumos" ON categorias_insumos;
CREATE POLICY "Aislamiento tenant categorias_insumos" ON categorias_insumos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

DROP POLICY IF EXISTS "Aislamiento tenant insumos" ON insumos;
CREATE POLICY "Aislamiento tenant insumos" ON insumos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

DROP POLICY IF EXISTS "Aislamiento tenant movimientos_insumos" ON movimientos_insumos;
CREATE POLICY "Aislamiento tenant movimientos_insumos" ON movimientos_insumos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );
