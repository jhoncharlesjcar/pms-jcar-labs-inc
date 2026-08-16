-- ============================================================
-- HARDENING: Row Level Security (RLS) Multi-tenant
-- ============================================================

-- 1. Eliminar políticas permisivas previas
DROP POLICY IF EXISTS "allow_all_hoteles" ON hoteles;
DROP POLICY IF EXISTS "allow_all_habitaciones" ON habitaciones;
DROP POLICY IF EXISTS "allow_all_reservas" ON reservas;
DROP POLICY IF EXISTS "allow_all_ventas" ON ventas;
DROP POLICY IF EXISTS "allow_all_config_hotel" ON config_hotel;
DROP POLICY IF EXISTS "allow_all_servicios_extra" ON servicios_extra;
DROP POLICY IF EXISTS "allow_all_ventas_pos" ON ventas_pos;
DROP POLICY IF EXISTS "allow_all_codigos_desbloqueo" ON codigos_desbloqueo;
DROP POLICY IF EXISTS "allow_all_usuarios" ON usuarios;

-- 2. Asegurar que RLS esté habilitado
ALTER TABLE hoteles ENABLE ROW LEVEL SECURITY;
ALTER TABLE habitaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_hotel ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios_extra ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas_pos ENABLE ROW LEVEL SECURITY;
ALTER TABLE codigos_desbloqueo ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 3. Políticas para la tabla 'usuarios' (Perfil propio)
CREATE POLICY "usuarios_read_own" ON usuarios
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "usuarios_update_own" ON usuarios
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 4. Políticas para la tabla 'hoteles'
-- Un usuario solo puede ver el hotel al que está asignado
CREATE POLICY "hoteles_tenant_isolation" ON hoteles
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- 5. Políticas Multi-tenant (Aislamiento por hotel_id)
-- Aplicable a: habitaciones, reservas, ventas, config_hotel, servicios_extra, ventas_pos

-- habitaciones
CREATE POLICY "habitaciones_tenant_isolation" ON habitaciones
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- reservas
CREATE POLICY "reservas_tenant_isolation" ON reservas
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- ventas
CREATE POLICY "ventas_tenant_isolation" ON ventas
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- config_hotel
CREATE POLICY "config_hotel_tenant_isolation" ON config_hotel
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- servicios_extra
CREATE POLICY "servicios_extra_tenant_isolation" ON servicios_extra
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- ventas_pos
CREATE POLICY "ventas_pos_tenant_isolation" ON ventas_pos
  FOR ALL TO authenticated
  USING (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  )
  WITH CHECK (
    hotel_id IN (SELECT hotel_id FROM usuarios WHERE id = auth.uid())
    OR 
    (SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer'
  );

-- 6. Políticas para 'codigos_desbloqueo' (Solo desarrolladores pueden ver/crear, todos pueden usar?)
-- Por ahora restringido a desarrolladores para mayor seguridad
CREATE POLICY "codigos_dev_only" ON codigos_desbloqueo
  FOR ALL TO authenticated
  USING ((SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer')
  WITH CHECK ((SELECT role FROM usuarios WHERE id = auth.uid()) = 'developer');

-- 7. Actualizar Trigger para perfiles de usuario
-- El alta publica nunca puede elegir tenant, rol privilegiado ni activarse sola.
-- La asignacion al hotel se realiza exclusivamente mediante invite-user.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, email, full_name, role, hotel_id, activo)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        'recepcionista',
        NULL,
        false
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

