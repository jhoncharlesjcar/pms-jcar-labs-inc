-- ==============================================================================
-- 🛡️ SCRIPT DE SEGURIDAD MULTI-TENANT OPTIMIZADO (ROW LEVEL SECURITY)
-- ==============================================================================
-- Se ha optimizado la extracción del hotel_id mediante una función STABLE.
-- Esto previene que PostgreSQL ejecute la consulta 'SELECT hotel_id FROM usuarios'
-- por cada fila de la tabla (solucionando el grave problema de N+1 de latencia).

-- 0. Función Optimizada (STABLE) para obtener el Hotel ID del usuario actual
CREATE OR REPLACE FUNCTION get_user_hotel_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT hotel_id FROM usuarios WHERE id = auth.uid();
$$;

-- 1. Habilitar RLS en todas las tablas transaccionales
ALTER TABLE habitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE egresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cierres_caja ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas antiguas si existen para evitar duplicados
DROP POLICY IF EXISTS "Aislamiento tenant habitaciones" ON habitaciones;
DROP POLICY IF EXISTS "Aislamiento tenant reservas" ON reservas;
DROP POLICY IF EXISTS "Aislamiento tenant ventas" ON ventas;
DROP POLICY IF EXISTS "Aislamiento tenant ventas pos" ON ventas_pos;
DROP POLICY IF EXISTS "Aislamiento tenant productos" ON productos;
DROP POLICY IF EXISTS "Aislamiento tenant categorias" ON categorias_productos;
DROP POLICY IF EXISTS "Aislamiento tenant egresos" ON egresos;
DROP POLICY IF EXISTS "Aislamiento tenant cierres_caja" ON cierres_caja;

-- 3. Crear las nuevas políticas usando la función optimizada get_user_hotel_id()

CREATE POLICY "Aislamiento tenant habitaciones" ON habitaciones 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant reservas" ON reservas 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant ventas" ON ventas 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant ventas pos" ON ventas_pos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant productos" ON productos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant categorias" ON categorias_productos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant egresos" ON egresos 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

CREATE POLICY "Aislamiento tenant cierres_caja" ON cierres_caja 
FOR ALL USING ( hotel_id = get_user_hotel_id() );

-- 4. Usuarios y Hoteles
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON usuarios;
CREATE POLICY "Usuarios ven su propio perfil" ON usuarios 
FOR SELECT USING ( id = auth.uid() );

ALTER TABLE hoteles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver hotel asignado" ON hoteles;
CREATE POLICY "Ver hotel asignado" ON hoteles 
FOR SELECT USING ( id = get_user_hotel_id() );

