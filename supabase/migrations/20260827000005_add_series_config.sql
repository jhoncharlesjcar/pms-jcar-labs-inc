-- ============================================================
-- SUNAT: series configurables por hotel
-- Permite que cada hotel use sus series autorizadas (F001/B001/FC01/FD01/BC01/BD01).
-- ============================================================

ALTER TABLE public.hoteles
  ADD COLUMN IF NOT EXISTS serie_factura text DEFAULT 'F001',
  ADD COLUMN IF NOT EXISTS serie_boleta text DEFAULT 'B001',
  ADD COLUMN IF NOT EXISTS serie_nc_factura text DEFAULT 'FC01',
  ADD COLUMN IF NOT EXISTS serie_nd_factura text DEFAULT 'FD01',
  ADD COLUMN IF NOT EXISTS serie_nc_boleta text DEFAULT 'BC01',
  ADD COLUMN IF NOT EXISTS serie_nd_boleta text DEFAULT 'BD01';

-- Recrear el RPC para exponer las series (sin exponer secretos adicionales).
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
  sunat_certificado_pem text,
  serie_factura text,
  serie_boleta text,
  serie_nc_factura text,
  serie_nd_factura text,
  serie_nc_boleta text,
  serie_nd_boleta text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
  SELECT h.id, h.nombre::text, h.razon_social::text, h.ruc::text, h.direccion::text, h.ciudad::text,
         h.ubigeo::text, h.departamento::text, h.provincia::text, h.distrito::text, h.aplica_igv,
         h.sunat_usuario_sol::text, s.sunat_clave_sol, h.sunat_modo_prueba,
         s.sunat_certificado_pem,
         h.serie_factura::text, h.serie_boleta::text,
         h.serie_nc_factura::text, h.serie_nd_factura::text,
         h.serie_nc_boleta::text, h.serie_nd_boleta::text
  FROM public.hoteles h
  LEFT JOIN private.hotel_secrets s ON s.hotel_id = h.id
  WHERE h.id = p_hotel_id AND auth.role() = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.get_hotel_sunat_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_sunat_credentials(uuid) TO service_role;
