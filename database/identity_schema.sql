-- ============================================================
-- SCHEMA: Microservicio de Identidad Fiscal (DNI / RUC)
-- ============================================================

-- TABLA: identity_cache (Caché global)
CREATE TABLE IF NOT EXISTS public.identity_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('DNI', 'RUC')),
    document_number TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    last_update TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de búsqueda y limpieza
CREATE INDEX IF NOT EXISTS idx_identity_cache_doc ON public.identity_cache(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_identity_cache_update ON public.identity_cache(last_update);

-- TABLA: identity_logs (Para observabilidad por Hotel)
CREATE TABLE IF NOT EXISTS public.identity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID REFERENCES public.hoteles(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL,
    response_time_ms INTEGER,
    source TEXT DEFAULT 'API' CHECK (source IN ('API', 'CACHE')),
    success BOOLEAN DEFAULT true,
    error_msg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_logs_hotel ON public.identity_logs(hotel_id, created_at DESC);

-- RLS para Logs (Cada hotel ve sus propios logs, el caché es público para lectura)
ALTER TABLE public.identity_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Caché: Todos los usuarios autenticados pueden leer. Solo la Service Role (Edge Functions) inserta.
CREATE POLICY "Lectura global de cache" ON public.identity_cache FOR SELECT TO authenticated USING (true);
-- Nota: La inserción y actualización la hace la Edge Function usando SERVICE_ROLE, por lo que no requiere política explícita para INSERTS de usuarios.

-- Políticas de Logs: Ver los logs del propio hotel
CREATE POLICY "ver_propios_logs" ON public.identity_logs FOR SELECT TO authenticated USING (hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid()));

-- RPC Función para limpiar caché expirado (Opcional, se puede llamar vía pg_cron o Edge Function)
CREATE OR REPLACE FUNCTION clean_expired_identity_cache()
RETURNS void AS $$
BEGIN
  -- Eliminar DNI más viejos de 30 días
  DELETE FROM public.identity_cache WHERE document_type = 'DNI' AND last_update < NOW() - INTERVAL '30 days';
  -- Eliminar RUC más viejos de 24 horas
  DELETE FROM public.identity_cache WHERE document_type = 'RUC' AND last_update < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
