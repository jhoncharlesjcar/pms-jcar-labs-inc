-- Optimizacion de indices para consultas comunes en Supabase (api/db.js)

-- 1. Reservas: Listado y Global Search
CREATE INDEX IF NOT EXISTS idx_reservas_hotel_date ON reservas (hotel_id, created_date DESC);

-- 2. Comprobantes: Listado en facturacion (OJO: Usa created_at)
CREATE INDEX IF NOT EXISTS idx_comprobantes_hotel_date ON comprobantes (hotel_id, created_at DESC);

-- 3. Productos y Categorias: Listado en inventario/POS
CREATE INDEX IF NOT EXISTS idx_productos_hotel_date ON productos (hotel_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_hotel ON categorias_productos (hotel_id);

-- 4. Tarifas Dinamicas: Consulta de tarifas activas
CREATE INDEX IF NOT EXISTS idx_tarifas_activas ON tarifas_dinamicas (hotel_id) WHERE activo = true;

-- 5. Habitaciones: Listados frecuentes
CREATE INDEX IF NOT EXISTS idx_habitaciones_hotel_date ON habitaciones (hotel_id, created_date DESC);
