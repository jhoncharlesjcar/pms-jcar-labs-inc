-- 📂 MIGRACIÓN: Crear Tabla de Auditoría Inmutable (Audit Log) y Triggers
-- Copia y ejecuta este script en el editor SQL de tu Supabase Dashboard.

CREATE TABLE IF NOT EXISTS audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid REFERENCES hoteles(id) ON DELETE CASCADE,
  usuario_id     uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  accion         text NOT NULL, -- E.g. 'INSERT', 'UPDATE', 'DELETE'
  tabla_afectada text NOT NULL,
  registro_id    uuid,
  detalles       jsonb, -- Almacenar los datos cambiados en formato JSON
  created_date   timestamp with time zone DEFAULT now()
);

-- Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Crear políticas para aislamiento multi-tenant
CREATE POLICY "Permitir lectura de logs para staff del hotel" ON audit_logs
  FOR SELECT TO authenticated USING (
    hotel_id = get_user_hotel_id()
  );

-- Prevenir inserción manual o modificación (Inmutabilidad Estricta)
-- NOTA: Las inserciones se harán a través del TRIGGER ejecutado con permisos de DB,
-- por lo que no damos permisos de INSERT manual a los usuarios autenticados.

-- ==============================================================================
-- 🚀 IMPLEMENTACIÓN DE TRIGGERS AUTOMÁTICOS
-- ==============================================================================
-- Función genérica para registrar cambios automáticamente
CREATE OR REPLACE FUNCTION log_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (hotel_id, usuario_id, accion, tabla_afectada, registro_id, detalles)
  VALUES (
    -- Si auth.uid() es nulo (ej. Cron Job / Backend), usar el hotel_id del registro afectado
    COALESCE(get_user_hotel_id(), COALESCE(NEW.hotel_id, OLD.hotel_id)),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    jsonb_build_object(
      'old', row_to_json(OLD), 
      'new', row_to_json(NEW),
      'ejecutado_por', CASE WHEN auth.uid() IS NULL THEN 'Sistema/API' ELSE 'Usuario' END
    )
  );
  
  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Trigger para tabla Ventas
DROP TRIGGER IF EXISTS audit_ventas_trigger ON ventas;
CREATE TRIGGER audit_ventas_trigger
AFTER INSERT OR UPDATE OR DELETE ON ventas
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Trigger para tabla Reservas
DROP TRIGGER IF EXISTS audit_reservas_trigger ON reservas;
CREATE TRIGGER audit_reservas_trigger
AFTER INSERT OR UPDATE OR DELETE ON reservas
FOR EACH ROW EXECUTE FUNCTION log_table_changes();

-- Trigger para tabla Cierres de Caja
DROP TRIGGER IF EXISTS audit_cierres_trigger ON cierres_caja;
CREATE TRIGGER audit_cierres_trigger
AFTER INSERT OR UPDATE OR DELETE ON cierres_caja
FOR EACH ROW EXECUTE FUNCTION log_table_changes();
