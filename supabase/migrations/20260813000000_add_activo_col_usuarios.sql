-- ==============================================================================
-- PMS JCAR LABS — Soft-Delete para Usuarios
-- Path: supabase/migrations/20260813000000_add_activo_col_usuarios.sql
-- ==============================================================================

-- 1. Agregar columna activo con default TRUE
ALTER TABLE public.usuarios 
ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

-- 2. Índice parcial para filtrar solo usuarios activos rápidamente
CREATE INDEX IF NOT EXISTS idx_usuarios_activo 
ON public.usuarios (activo) 
WHERE activo = true;

-- 3. Actualizar políticas RLS de usuarios
DROP POLICY IF EXISTS "Usuarios ven su propio perfil" ON usuarios;
CREATE POLICY "Usuarios ven su propio perfil" ON usuarios 
FOR SELECT USING (
    id = auth.uid()
);

-- 4. Política para que admin/developer puedan ver TODOS los usuarios
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

-- 6. Verificación de usuario activo
CREATE OR REPLACE FUNCTION is_user_active(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(activo, true) FROM usuarios WHERE id = user_id;
$$;
