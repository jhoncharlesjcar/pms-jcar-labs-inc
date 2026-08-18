-- ============================================================
-- P0-3 FIX: Return sunat_certificado_pem from get_hotel_sunat_credentials
-- The function existed but did NOT return the per-hotel certificate,
-- causing all hotels to use the global env var certificate.
-- Path: supabase/migrations/20260817000001_fix_sunat_credentials_return.sql
-- ============================================================

-- Drop previous signature before changing return type
DROP FUNCTION IF EXISTS public.get_hotel_sunat_credentials(uuid);

CREATE OR REPLACE FUNCTION public.get_hotel_sunat_credentials(p_hotel_id uuid)
RETURNS TABLE(
  id uuid, nombre text, ruc text, direccion text, ciudad text, aplica_igv boolean,
  sunat_usuario_sol text, sunat_clave_sol text, sunat_modo_prueba boolean,
  sunat_certificado_pem text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
  SELECT h.id, h.nombre::text, h.ruc::text, h.direccion::text, h.ciudad::text, h.aplica_igv,
         h.sunat_usuario_sol::text, s.sunat_clave_sol, h.sunat_modo_prueba,
         s.sunat_certificado_pem
  FROM public.hoteles h
  LEFT JOIN private.hotel_secrets s ON s.hotel_id = h.id
  WHERE h.id = p_hotel_id AND auth.role() = 'service_role';
$$;

-- Permissions remain the same (already granted to service_role only)
REVOKE ALL ON FUNCTION public.get_hotel_sunat_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_sunat_credentials(uuid) TO service_role;
