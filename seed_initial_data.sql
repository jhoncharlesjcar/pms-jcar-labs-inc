-- ============================================================
-- SCRIPT DE DATOS INICIALES (SEED)
-- Copia y pega esto en el Editor SQL de Supabase
-- ============================================================

-- 1. Insertar Hotel por Defecto (Si no existe)
INSERT INTO hoteles (nombre, ruc, direccion, ciudad, telefono, activo)
VALUES ('Hospedaje Angelica Frey', '10000000000', 'Av. Principal 123', 'Ciudad', '987654321', true)
ON CONFLICT DO NOTHING;

-- Obtener el ID del hotel recién creado (o el existente)
DO $$
DECLARE
    v_hotel_id UUID;
BEGIN
    -- Seleccionamos el primer hotel encontrado
    SELECT id INTO v_hotel_id FROM hoteles LIMIT 1;

    -- 2. Insertar Habitaciones
    IF v_hotel_id IS NOT NULL THEN
        -- Limpiar si es necesario (opcional)
        -- DELETE FROM habitaciones WHERE hotel_id = v_hotel_id;
        
        INSERT INTO habitaciones (hotel_id, numero, tipo, precio_noche, estado, capacidad, piso)
        VALUES 
        (v_hotel_id, '101', 'simple', 40.00, 'disponible', 1, '1'),
        (v_hotel_id, '102', 'doble simple', 60.00, 'disponible', 2, '1'),
        (v_hotel_id, '103', 'matrimonial', 70.00, 'disponible', 2, '1'),
        (v_hotel_id, '201', 'queen', 100.00, 'disponible', 2, '2'),
        (v_hotel_id, '202', 'mixta', 80.00, 'disponible', 3, '2')
        ON CONFLICT DO NOTHING;

        -- 3. Insertar Productos Minimarket (Servicios Extra)
        INSERT INTO servicios_extra (hotel_id, nombre, categoria, precio, disponible, emoji, stock)
        VALUES
        (v_hotel_id, 'Agua San Mateo 500ml', 'bebidas', 2.50, true, '💧', 50),
        (v_hotel_id, 'Inca Kola 500ml', 'bebidas', 3.00, true, '🥤', 24),
        (v_hotel_id, 'Cerveza Pilsen Latón', 'licores', 7.00, true, '🍺', 12),
        (v_hotel_id, 'Galletas Oreo', 'snacks', 1.50, true, '🍪', 30),
        (v_hotel_id, 'Papas Lays Clásicas', 'snacks', 2.00, true, '🍟', 20),
        (v_hotel_id, 'Set de Aseo (Shampoo/Jabón)', 'higiene', 5.00, true, '🧼', 40)
        ON CONFLICT DO NOTHING;

        -- 4. Vincular usuarios existentes al hotel (Para que puedan ver los datos)
        UPDATE usuarios SET hotel_id = v_hotel_id WHERE hotel_id IS NULL;
    END IF;
END $$;
