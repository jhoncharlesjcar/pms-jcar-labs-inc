-- ============================================================
-- FIX: Identity Cache & Audit Logs Tables
-- Creates tables required by the identity Edge Function (DNI/RUC query cache and logs).
-- Path: supabase/migrations/20260818000008_identity_tables.sql
-- ============================================================

-- 1. Identity Cache (DNI & RUC cache with TTL)
CREATE TABLE IF NOT EXISTS public.identity_cache (
    document_number TEXT PRIMARY KEY,
    document_type TEXT NOT NULL CHECK (document_type IN ('DNI', 'RUC')),
    data JSONB NOT NULL,
    last_update TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.identity_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_cache FROM anon, authenticated;

-- 2. Identity Logs (Audit trail for DNI/RUC lookups)
CREATE TABLE IF NOT EXISTS public.identity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES public.hoteles(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('DNI', 'RUC')),
    document_number TEXT NOT NULL,
    response_time_ms INTEGER,
    source TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT true,
    error_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.identity_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.identity_logs FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_identity_logs_hotel ON public.identity_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_identity_logs_created ON public.identity_logs(created_at DESC);

-- 3. Storage bucket for hotel assets (logos, payment QR codes)
INSERT INTO storage.buckets (id, name, public)
VALUES ('hoteles-assets', 'hoteles-assets', true)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
