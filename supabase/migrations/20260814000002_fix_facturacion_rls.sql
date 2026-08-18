-- Fiscal tables: tenant-safe read-only RLS and atomic numbering.

ALTER TABLE public.comprobantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobante_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comprobante_xml ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunat_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdr ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.comprobantes
  ADD COLUMN IF NOT EXISTS source_table text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.comprobantes'::regclass
      AND conname = 'comprobantes_source_table_check'
  ) THEN
    ALTER TABLE public.comprobantes ADD CONSTRAINT comprobantes_source_table_check
      CHECK (source_table IS NULL OR source_table IN ('ventas', 'ventas_pos'));
  END IF;
END $$;

-- Deduplicate historical records before applying unique constraints
DELETE FROM public.comprobantes a
USING public.comprobantes b
WHERE a.id < b.id
  AND a.hotel_id = b.hotel_id
  AND a.tipo = b.tipo
  AND a.serie = b.serie
  AND a.numero = b.numero;

DELETE FROM public.comprobantes a
USING public.comprobantes b
WHERE a.id < b.id
  AND a.source_table IS NOT NULL
  AND b.source_table IS NOT NULL
  AND a.source_id IS NOT NULL
  AND b.source_id IS NOT NULL
  AND a.source_table = b.source_table
  AND a.source_id = b.source_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_correlativo
  ON public.comprobantes(hotel_id, tipo, serie, numero);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comprobante_source
  ON public.comprobantes(source_table, source_id)
  WHERE source_table IS NOT NULL AND source_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.comprobante_sequences (
  hotel_id uuid NOT NULL REFERENCES public.hoteles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  serie text NOT NULL,
  ultimo_numero bigint NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  PRIMARY KEY (hotel_id, tipo, serie)
);
ALTER TABLE public.comprobante_sequences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.comprobante_sequences FROM anon, authenticated;

-- Initialize sequences from existing comprobantes if any
INSERT INTO public.comprobante_sequences(hotel_id, tipo, serie, ultimo_numero)
SELECT 
  hotel_id,
  tipo,
  serie,
  COALESCE(MAX(NULLIF(regexp_replace(numero, '\D', '', 'g'), '')::bigint), 0)
FROM public.comprobantes
GROUP BY hotel_id, tipo, serie
ON CONFLICT (hotel_id, tipo, serie) 
DO UPDATE SET ultimo_numero = GREATEST(public.comprobante_sequences.ultimo_numero, EXCLUDED.ultimo_numero);

CREATE OR REPLACE FUNCTION public.next_comprobante_number(p_hotel_id uuid, p_tipo text, p_serie text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'service role required';
  END IF;
  INSERT INTO public.comprobante_sequences(hotel_id, tipo, serie, ultimo_numero)
  VALUES (p_hotel_id, p_tipo, p_serie, 1)
  ON CONFLICT (hotel_id, tipo, serie)
  DO UPDATE SET ultimo_numero = public.comprobante_sequences.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_next;
  RETURN lpad(v_next::text, 8, '0');
END;
$$;
REVOKE ALL ON FUNCTION public.next_comprobante_number(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_comprobante_number(uuid, text, text) TO service_role;

DROP POLICY IF EXISTS "comprobantes_select_by_hotel" ON public.comprobantes;
DROP POLICY IF EXISTS "comprobantes_insert_by_hotel" ON public.comprobantes;
DROP POLICY IF EXISTS "comprobantes_update_by_hotel" ON public.comprobantes;
DROP POLICY IF EXISTS "comprobantes_delete_dev_only" ON public.comprobantes;
DROP POLICY IF EXISTS "comprobante_detalle_select_by_hotel" ON public.comprobante_detalle;
DROP POLICY IF EXISTS "comprobante_detalle_insert_by_hotel" ON public.comprobante_detalle;
DROP POLICY IF EXISTS "comprobante_xml_select_by_hotel" ON public.comprobante_xml;
DROP POLICY IF EXISTS "comprobante_xml_insert_by_hotel" ON public.comprobante_xml;
DROP POLICY IF EXISTS "sunat_envios_select_by_hotel" ON public.sunat_envios;
DROP POLICY IF EXISTS "sunat_envios_insert_by_hotel" ON public.sunat_envios;
DROP POLICY IF EXISTS "cdr_select_by_hotel" ON public.cdr;
DROP POLICY IF EXISTS "cdr_insert_by_hotel" ON public.cdr;

CREATE POLICY "comprobantes_select_by_hotel" ON public.comprobantes
  FOR SELECT TO authenticated
  USING (
    public.is_user_active()
    AND (hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
  );

CREATE POLICY "comprobante_detalle_select_by_hotel" ON public.comprobante_detalle
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.id = comprobante_id
        AND (c.hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
    )
  );
CREATE POLICY "comprobante_xml_select_by_hotel" ON public.comprobante_xml
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.id = comprobante_id
        AND (c.hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
    )
  );
CREATE POLICY "sunat_envios_select_by_hotel" ON public.sunat_envios
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.id = comprobante_id
        AND (c.hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
    )
  );
CREATE POLICY "cdr_select_by_hotel" ON public.cdr
  FOR SELECT TO authenticated USING (
    public.is_user_active() AND EXISTS (
      SELECT 1 FROM public.comprobantes c
      WHERE c.id = comprobante_id
        AND (c.hotel_id = public.get_user_hotel_id() OR public.get_user_role() = 'developer')
    )
  );

REVOKE ALL ON public.comprobantes FROM anon;
REVOKE ALL ON public.comprobante_detalle FROM anon;
REVOKE ALL ON public.comprobante_xml FROM anon;
REVOKE ALL ON public.sunat_envios FROM anon;
REVOKE ALL ON public.cdr FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.comprobantes FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comprobante_detalle FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comprobante_xml FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.sunat_envios FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.cdr FROM authenticated;
GRANT SELECT ON public.comprobantes TO authenticated;
GRANT SELECT ON public.comprobante_detalle TO authenticated;
GRANT SELECT ON public.comprobante_xml TO authenticated;
GRANT SELECT ON public.sunat_envios TO authenticated;
GRANT SELECT ON public.cdr TO authenticated;
