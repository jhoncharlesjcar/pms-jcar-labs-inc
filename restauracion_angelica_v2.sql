-- ============================================================
-- 🚀 SCRIPT DE RESTAURACIÓN TOTAL: HOSPEDAJE ANGÉLICA FREY
-- ============================================================
-- Este script realiza 3 acciones críticas:
-- 1. Corrige errores de recursión en las políticas de seguridad (RLS).
-- 2. Asegura la existencia del hotel y vincula a los usuarios.
-- 3. Restaura el catálogo completo de habitaciones y minimarket.
-- ============================================================

-- [1] CORRECCIÓN DE SEGURIDAD (RLS) - ELIMINAR RECURSIÓN
-- Eliminamos políticas que causaban bucles infinitos
DROP POLICY IF EXISTS "ver_perfiles_mismo_hotel" ON usuarios;
DROP POLICY IF EXISTS "hoteles_tenant_isolation" ON hoteles;
DROP POLICY IF EXISTS "habitaciones_tenant_isolation" ON habitaciones;
DROP POLICY IF EXISTS "servicios_extra_tenant_isolation" ON servicios_extra;

-- Política de Usuarios segura (Usa auth.uid() directamente)
CREATE POLICY "usuarios_read_self" ON usuarios FOR SELECT USING (id = auth.uid());
CREATE POLICY "usuarios_read_all" ON usuarios FOR SELECT USING (true); -- Permitir ver staff para asignaciones

-- Política de Hoteles simplificada
CREATE POLICY "hoteles_read_access" ON hoteles FOR SELECT USING (activo = true);

-- [2] RESTAURACIÓN DE DATOS MAESTROS
DO $$
DECLARE
    v_hotel_id UUID;
BEGIN
    -- A. Asegurar Hotel
    INSERT INTO hoteles (nombre, ruc, direccion, ciudad, telefono, activo)
    VALUES ('Hospedaje Angelica Frey', '10000000000', 'Jr. Principal 123', 'Cusco', '987654321', true)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_hotel_id FROM hoteles WHERE nombre ILIKE '%Angelica Frey%' LIMIT 1;

    IF v_hotel_id IS NOT NULL THEN
        
        -- B. Restaurar Habitaciones (Set Completo)
        -- Borramos anteriores para evitar duplicados si el usuario quiere "limpieza total"
        DELETE FROM habitaciones WHERE hotel_id = v_hotel_id;
        
        INSERT INTO habitaciones (hotel_id, numero, tipo, precio_noche, estado, capacidad, piso, descripcion)
        VALUES 
        -- PISO 1
        (v_hotel_id, '101', 'simple', 40.00, 'disponible', 1, '1', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '102', 'doble simple', 60.00, 'disponible', 2, '1', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '103', 'matrimonial', 70.00, 'disponible', 2, '1', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '104', 'matrimonial', 70.00, 'disponible', 2, '1', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '105', 'queen', 90.00, 'disponible', 2, '1', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        -- PISO 2
        (v_hotel_id, '201', 'simple', 40.00, 'disponible', 1, '2', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '202', 'matrimonial', 70.00, 'disponible', 2, '2', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '203', 'matrimonial', 75.00, 'disponible', 2, '2', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '204', 'doble matrimonial', 120.00, 'disponible', 4, '2', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '205', 'mixta', 85.00, 'disponible', 3, '2', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        -- PISO 3
        (v_hotel_id, '301', 'simple', 45.00, 'disponible', 1, '3', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '302', 'matrimonial', 75.00, 'disponible', 2, '3', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '303', 'matrimonial', 75.00, 'disponible', 2, '3', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '304', 'queen', 100.00, 'disponible', 2, '3', '{"wifi":true,"tv":true,"agua":true,"bano":true}'),
        (v_hotel_id, '305', 'mixta', 90.00, 'disponible', 3, '3', '{"wifi":true,"tv":true,"agua":true,"bano":true}');

        -- C. Restaurar Minimarket (Catálogo Completo)
        DELETE FROM servicios_extra WHERE hotel_id = v_hotel_id;

        INSERT INTO servicios_extra (hotel_id, nombre, categoria, precio, disponible, emoji, stock)
        VALUES
        (v_hotel_id, 'Agua San Mateo 500ml', 'bebidas', 2.50, true, '💧', 100),
        (v_hotel_id, 'Inca Kola 500ml', 'bebidas', 3.00, true, '🥤', 48),
        (v_hotel_id, 'Coca Cola 500ml', 'bebidas', 3.00, true, '🥤', 48),
        (v_hotel_id, 'Cerveza Pilsen Latón', 'licores', 7.50, true, '🍺', 24),
        (v_hotel_id, 'Cerveza Cristal Latón', 'licores', 7.00, true, '🍺', 24),
        (v_hotel_id, 'Papas Lays Clásicas', 'snacks', 2.50, true, '🍟', 30),
        (v_hotel_id, 'Galletas Oreo', 'snacks', 1.50, true, '🍪', 50),
        (v_hotel_id, 'Chocolate Sublime', 'snacks', 2.00, true, '🍫', 40),
        (v_hotel_id, 'Papel Higiénico Elite', 'higiene', 1.50, true, '🧻', 20),
        (v_hotel_id, 'Set Aseo (Shampoo/Jabón)', 'higiene', 5.00, true, '🧼', 50),
        (v_hotel_id, 'Desodorante Rexona', 'higiene', 8.00, true, '🧴', 12),
        (v_hotel_id, 'Cigarrillos Hamilton 10u', 'cigarros', 10.00, true, '🚬', 10);

        -- D. Vincular perfiles de usuario al hotel para que puedan ver los datos
        UPDATE usuarios SET hotel_id = v_hotel_id;
        
        -- E. Configuración del Hotel
        INSERT INTO config_hotel (hotel_id, nombre_hotel, ruc, direccion, telefono, ciudad, mensaje_ticket)
        VALUES (v_hotel_id, 'Hospedaje Angelica Frey', '10000000000', 'Jr. Principal 123', '987654321', 'Cusco', '¡Gracias por visitarnos!')
        ON CONFLICT DO NOTHING;

    END IF;
END $$;

-- [3] HABILITAR POLÍTICAS TENANT (Una vez vinculados los usuarios)
CREATE POLICY "habitaciones_tenant_isolation" ON habitaciones FOR ALL USING (hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid()));
CREATE POLICY "servicios_extra_tenant_isolation" ON servicios_extra FOR ALL USING (hotel_id = (SELECT hotel_id FROM usuarios WHERE id = auth.uid()));
