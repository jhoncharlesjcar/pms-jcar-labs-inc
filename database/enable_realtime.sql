-- 🚀 Supabase Realtime: Habilitar Tiempo Real en Tablas Críticas
-- Ejecuta este script en el editor SQL de Supabase para permitir 
-- que la UI reciba actualizaciones instantáneas sin recargar la página.

BEGIN;

-- Habilitar publicación para el esquema public (si no lo está)
-- "supabase_realtime" es la publicación que lee el backend de realtime de Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE habitaciones;
ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas;
ALTER PUBLICATION supabase_realtime ADD TABLE checkins_publicos;
ALTER PUBLICATION supabase_realtime ADD TABLE ventas_pos;

COMMIT;

-- NOTA: Si alguna tabla ya estaba agregada a supabase_realtime, 
-- PostgreSQL arrojará un error de que ya existe en la publicación. 
-- Puedes ignorarlo o quitarla del script.
