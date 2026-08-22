-- ============================================================
-- MIGRACIÓN JCAR AI SALES AGENT — PMS JCAR LABS
-- Crea las tablas base para el funcionamiento del agente IA
-- Path: supabase/migrations/20260822000001_ai_agent_tables.sql
-- ============================================================

-- ────────────────────────────────────────────────────────────────
-- 1. AI HOTEL CONFIG (Configuración por hotel)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_hotel_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE UNIQUE,
    agent_enabled BOOLEAN NOT NULL DEFAULT false,
    agent_name TEXT NOT NULL DEFAULT 'Asistente',
    agent_personality TEXT DEFAULT 'amable, profesional y eficiente',
    welcome_message TEXT DEFAULT '¡Hola! 👋 Soy el asistente virtual. ¿En qué puedo ayudarte?',
    languages TEXT[] DEFAULT '{es}',
    operating_hours JSONB DEFAULT '{"24_7": true}'::jsonb,
    handoff_message TEXT DEFAULT 'He registrado tu consulta. En este momento nuestros agentes están fuera de línea, pero te contactaremos a primera hora para ayudarte.',
    max_concurrent_conversations INTEGER DEFAULT 50,
    auto_followup_enabled BOOLEAN NOT NULL DEFAULT false,
    upselling_enabled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_hotel_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ai_hotel_config solo para staff" ON public.ai_hotel_config
    FOR SELECT TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "Permitir mutaciones ai_hotel_config para staff" ON public.ai_hotel_config
    FOR ALL TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    ) WITH CHECK (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────────
-- 2. AI HOTEL KNOWLEDGE (Base de conocimiento)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_hotel_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN (
        'general', 'servicios', 'politicas', 'ubicacion', 
        'faq', 'amenidades', 'transporte', 'alrededores'
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_hotel_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ai_hotel_knowledge solo para staff" ON public.ai_hotel_knowledge
    FOR SELECT TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "Permitir mutaciones ai_hotel_knowledge para staff" ON public.ai_hotel_knowledge
    FOR ALL TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    ) WITH CHECK (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────────
-- 3. AI CONVERSATIONS (Conversaciones activas/históricas)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'manual')),
    session_id TEXT NOT NULL,
    guest_name TEXT,
    guest_phone TEXT,
    guest_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'quoted', 'booked', 'handed_off', 'abandoned', 'closed'
    )),
    intent TEXT CHECK (intent IN (
        'informacion', 'reserva', 'modificacion', 'cancelacion', 'queja', 'otro'
    )),
    metadata JSONB DEFAULT '{}'::jsonb,
    assigned_user_id UUID REFERENCES auth.users(id),
    reserva_id UUID REFERENCES public.reservas(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ
);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ai_conversations solo para staff" ON public.ai_conversations
    FOR SELECT TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "Permitir mutaciones ai_conversations para staff" ON public.ai_conversations
    FOR ALL TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    ) WITH CHECK (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────────
-- 4. AI MESSAGES (Mensajes de chat)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    tool_calls JSONB,
    tool_name TEXT,
    tool_result JSONB,
    tokens_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ai_messages solo para staff" ON public.ai_messages
    FOR SELECT TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "Permitir mutaciones ai_messages para staff" ON public.ai_messages
    FOR ALL TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    ) WITH CHECK (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────────
-- 5. AI QUOTES (Cotizaciones del agente)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
    room_type TEXT NOT NULL,
    habitacion_id UUID REFERENCES public.habitaciones(id),
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    noches INTEGER NOT NULL,
    adultos INTEGER NOT NULL DEFAULT 2,
    ninos INTEGER NOT NULL DEFAULT 0,
    precio_noche NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PEN',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'rejected')),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura ai_quotes solo para staff" ON public.ai_quotes
    FOR SELECT TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "Permitir mutaciones ai_quotes para staff" ON public.ai_quotes
    FOR ALL TO authenticated USING (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    ) WITH CHECK (
        hotel_id = (SELECT hotel_id FROM public.usuarios WHERE id = auth.uid())
    );

-- ────────────────────────────────────────────────────────────────
-- 6. ÍNDICES ÚTILES
-- ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ai_conversations_hotel ON public.ai_conversations(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_session ON public.ai_conversations(hotel_id, session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON public.ai_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_quotes_conversation ON public.ai_quotes(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_hotel_knowledge_hotel ON public.ai_hotel_knowledge(hotel_id, category, activo);

NOTIFY pgrst, 'reload schema';
