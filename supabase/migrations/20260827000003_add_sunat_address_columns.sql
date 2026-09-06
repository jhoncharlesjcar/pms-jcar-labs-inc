-- ============================================================
-- SUNAT: columnas de dirección fiscal y RPC de credenciales ampliado
-- El XML UBL 2.1 exige ubigeo (Catálogo 13), departamento, provincia,
-- distrito y razón social del emisor. Se añaden las columnas y se amplía
-- get_hotel_sunat_credentials para devolver la identidad fiscal completa.
-- ============================================================

ALTER TABLE public.hoteles
  ADD COLUMN IF NOT EXISTS ubigeo text,
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS distrito text;

DROP FUNCTION IF EXISTS public.get_hotel_sunat_credentials(uuid);

CREATE OR REPLACE FUNCTION public.get_hotel_sunat_credentials(p_hotel_id uuid)
RETURNS TABLE(
  id uuid,
  nombre text,
  razon_social text,
  ruc text,
  direccion text,
  ciudad text,
  ubigeo text,
  departamento text,
  provincia text,
  distrito text,
  aplica_igv boolean,
  sunat_usuario_sol text,
  sunat_clave_sol text,
  sunat_modo_prueba boolean,
  sunat_certificado_pem text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
  SELECT h.id, h.nombre::text, h.razon_social::text, h.ruc::text, h.direccion::text, h.ciudad::text,
         h.ubigeo::text, h.departamento::text, h.provincia::text, h.distrito::text, h.aplica_igv,
         h.sunat_usuario_sol::text, s.sunat_clave_sol, h.sunat_modo_prueba,
         s.sunat_certificado_pem
  FROM public.hoteles h
  LEFT JOIN private.hotel_secrets s ON s.hotel_id = h.id
  WHERE h.id = p_hotel_id AND auth.role() = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.get_hotel_sunat_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_sunat_credentials(uuid) TO service_role;
