-- ============================================================
-- SUNAT: soporte de Notas de Crédito (07) y Notas de Débito (08)
-- Añade la referencia al comprobante original y el tipo de nota (Catálogo 09).
-- ============================================================

ALTER TABLE public.comprobantes
  ADD COLUMN IF NOT EXISTS comprobante_ref_id bigint REFERENCES public.comprobantes(id),
  ADD COLUMN IF NOT EXISTS tipo_nota text,
  ADD COLUMN IF NOT EXISTS motivo text;

CREATE INDEX IF NOT EXISTS idx_comprobantes_ref ON public.comprobantes (comprobante_ref_id)
  WHERE comprobante_ref_id IS NOT NULL;
