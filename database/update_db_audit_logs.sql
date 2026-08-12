-- Crear tabla audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    usuario_id UUID,
    usuario_email TEXT,
    accion TEXT NOT NULL,
    descripcion TEXT,
    modulo TEXT,
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Políticas RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Solo lectura para admins del tenant" ON public.audit_logs
FOR SELECT USING (
    hotel_id = (SELECT get_user_hotel_id())
    AND (SELECT role FROM public.usuarios WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Insertar para todos en el tenant" ON public.audit_logs
FOR INSERT WITH CHECK (
    hotel_id = (SELECT get_user_hotel_id())
);
