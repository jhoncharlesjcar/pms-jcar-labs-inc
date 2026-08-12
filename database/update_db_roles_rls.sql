-- ==============================================================================
-- PMS JCAR LABS — SPRINT 1
-- Actualización de Políticas de Seguridad (RBAC) para Recepcionistas
-- ==============================================================================

-- 1. Función para obtener el rol del usuario actual
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM usuarios WHERE id = auth.uid();
$$;

-- 2. Modificar Política de DELETE en Reservas
-- Evita que los recepcionistas puedan borrar registros (DELETE),
-- obligándolos a usar la opción de "Cancelar" (UPDATE estado='cancelada')
DROP POLICY IF EXISTS "Aislamiento tenant reservas" ON reservas;

CREATE POLICY "Ver e Insertar reservas tenant" ON reservas 
FOR SELECT USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Crear reservas tenant" ON reservas 
FOR INSERT WITH CHECK ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Actualizar reservas tenant" ON reservas 
FOR UPDATE USING ( hotel_id = get_user_hotel_id() );

-- Solo admin puede borrar registros duros
CREATE POLICY "Admin puede borrar reservas" ON reservas 
FOR DELETE USING ( hotel_id = get_user_hotel_id() AND get_user_role() = 'admin' );

-- 3. Modificar Política de DELETE en Ventas
-- Las ventas registradas no deberían poder ser borradas por recepcionistas para evitar descuadres de caja malintencionados.
DROP POLICY IF EXISTS "Aislamiento tenant ventas" ON ventas;

CREATE POLICY "Ver e Insertar ventas tenant" ON ventas 
FOR SELECT USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Crear ventas tenant" ON ventas 
FOR INSERT WITH CHECK ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Actualizar ventas tenant" ON ventas 
FOR UPDATE USING ( hotel_id = get_user_hotel_id() AND get_user_role() = 'admin' );

CREATE POLICY "Admin puede borrar ventas" ON ventas 
FOR DELETE USING ( hotel_id = get_user_hotel_id() AND get_user_role() = 'admin' );
