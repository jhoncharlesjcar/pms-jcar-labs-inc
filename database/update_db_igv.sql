-- ═══════════════════════════════════════════════════════════════════
-- MIGRACIÓN: Configuración de IGV en tabla `hoteles`
-- PMS JCAR LABS — Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. AÑADIR CAMPO EN hoteles ─────────────────────────────

ALTER TABLE hoteles
  ADD COLUMN IF NOT EXISTS aplica_igv boolean DEFAULT true;
