-- ============================================================
-- MIGRACIÓN JCAR AI SALES AGENT — RETRASO DE RESPUESTA
-- Añade la columna para configurar el retraso (delay) del bot
-- Path: supabase/migrations/20260822000003_ai_agent_delay.sql
-- ============================================================

ALTER TABLE public.ai_hotel_config 
ADD COLUMN IF NOT EXISTS response_delay_seconds INTEGER DEFAULT 0;
