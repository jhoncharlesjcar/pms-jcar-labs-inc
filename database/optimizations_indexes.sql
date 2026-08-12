-- Batch 4 Optimizations: Índices para mejorar la velocidad de las consultas

-- 1. Recepción: Autocompletado DNI ultra-rápido
CREATE INDEX IF NOT EXISTS idx_reservas_huesped_dni ON reservas (huesped_dni);

-- 2. Dashboard: Carga de ventas recientes (últimos 30 días)
CREATE INDEX IF NOT EXISTS idx_ventas_hotel_date ON ventas (hotel_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_ventaspos_hotel_date ON ventas_pos (hotel_id, created_date DESC);

-- 3. Caja: Cierres y Egresos (Mejora la carga del historial)
CREATE INDEX IF NOT EXISTS idx_cierres_hotel_date ON cierres_caja (hotel_id, created_date DESC);
CREATE INDEX IF NOT EXISTS idx_egresos_hotel_date ON egresos (hotel_id, created_date DESC);

-- 4. Recepción: Índice Parcial para Habitaciones y Reservas Activas (Reduce el escaneo de filas para reservas históricas)
CREATE INDEX IF NOT EXISTS idx_reservas_activas ON reservas (hotel_id, estado) WHERE estado IN ('activa', 'pendiente');
