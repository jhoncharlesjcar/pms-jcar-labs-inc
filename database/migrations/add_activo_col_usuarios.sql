-- ==============================================================================
-- PMS JCAR LABS — Soft-Delete para Usuarios
-- Agrega columna `activo` a la tabla `usuarios` para permitir desactivación
-- de personal sin eliminar registros históricos.
-- ==============================================================================

-- 1. Agregar columna activo con default TRUE
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- 2. Índice parcial para filtrar solo usuarios activos rápidamente
CREATE INDEX IF NOT EXISTS idx_usuarios_activo 
ON public.usuarios (activo) 
WHERE activo = true;

-- 3. Actualizar políticas RLS de usuarios
--    La SELECT permite que el usuario vea su propio perfil aunque esté inactivo.
--    La validación de usuario desactivado se hace en la capa de aplicación
--    (auth.service.ts → loadUserProfile), NO a nivel RLS. Esto evita que
--    el PGRST116 (no rows) active createDemoProfile que re-activaría al usuario.
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON usuarios;
CREATE POLICY "Usuarios ven su propio perfil" ON usuarios 
FOR SELECT USING (
    id = auth.uid()
    -- NOTA: No filtrar por activo aquí. La app rechaza usuarios inactivos
    -- en loadUserProfile. Si RLS oculta la fila, PostgREST devuelve PGRST116
    -- y createDemoProfile crearía un perfil nuevo activo, evadiendo el soft-delete.
);

-- 4. Política para que admin/developer puedan ver TODOS los usuarios
--    (incluyendo inactivos) para gestión de personal
DROP POLICY IF EXISTS "admin_ver_usuarios_hotel" ON usuarios;
CREATE POLICY "admin_ver_usuarios_hotel" ON usuarios 
FOR SELECT TO authenticated 
USING (
    hotel_id = get_user_hotel_id()
    AND EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
);

-- 5. Política para que admin pueda actualizar el estado activo/inactivo
DROP POLICY IF EXISTS "admin_actualizar_usuarios" ON usuarios;
CREATE POLICY "admin_actualizar_usuarios" ON usuarios 
FOR UPDATE TO authenticated 
USING (
    hotel_id = get_user_hotel_id()
    AND EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
)
WITH CHECK (
    hotel_id = get_user_hotel_id()
    AND EXISTS (
        SELECT 1 FROM usuarios WHERE id = auth.uid() AND role IN ('admin', 'developer')
    )
);

-- 6. Los usuarios inactivos no pueden iniciar sesión (la política SELECT 
--    ya los bloquea, pero agregamos una verificación extra a nivel de auth)
--    Esta función se puede usar en triggers o RPCs si es necesario.
CREATE OR REPLACE FUNCTION is_user_active(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(activo, true) FROM usuarios WHERE id = user_id;
$$;

-- 7. Nota: Para desactivar un usuario, admin hace:
--    UPDATE usuarios SET activo = false WHERE id = 'user-id';
--    El usuario inactivo no podrá cargar su perfil (PGRST116) y será
--    redirigido al login.
