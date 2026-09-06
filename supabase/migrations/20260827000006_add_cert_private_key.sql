-- ============================================================
-- SUNAT: clave privada del certificado ICP por hotel
-- Cada hotel debe poder firmar con su propio certificado y clave privada,
-- no con un env var global. Se añade la columna y se actualizan los RPCs.
-- ============================================================

ALTER TABLE private.hotel_secrets
  ADD COLUMN IF NOT EXISTS sunat_cert_private_key_pem text;

-- set_hotel_secrets: aceptar la clave privada del certificado.
DROP FUNCTION IF EXISTS public.set_hotel_secrets(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.set_hotel_secrets(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.set_hotel_secrets(
  p_hotel_id uuid,
  p_sunat_clave_sol text DEFAULT NULL,
  p_sunat_certificado_pem text DEFAULT NULL,
  p_pasarela_private_key text DEFAULT NULL,
  p_sunat_cert_private_key_pem text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  INSERT INTO private.hotel_secrets(hotel_id, sunat_clave_sol, sunat_certificado_pem, pasarela_private_key, sunat_cert_private_key_pem)
  VALUES (
    p_hotel_id, NULLIF(btrim(p_sunat_clave_sol), ''),
    NULLIF(btrim(p_sunat_certificado_pem), ''), NULLIF(btrim(p_pasarela_private_key), ''),
    NULLIF(btrim(p_sunat_cert_private_key_pem), '')
  )
  ON CONFLICT (hotel_id) DO UPDATE SET
    sunat_clave_sol = COALESCE(EXCLUDED.sunat_clave_sol, private.hotel_secrets.sunat_clave_sol),
    sunat_certificado_pem = COALESCE(EXCLUDED.sunat_certificado_pem, private.hotel_secrets.sunat_certificado_pem),
    pasarela_private_key = COALESCE(EXCLUDED.pasarela_private_key, private.hotel_secrets.pasarela_private_key),
    sunat_cert_private_key_pem = COALESCE(EXCLUDED.sunat_cert_private_key_pem, private.hotel_secrets.sunat_cert_private_key_pem),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_hotel_secrets(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_hotel_secrets(uuid, text, text, text, text) TO service_role;

-- get_hotel_sunat_credentials: devolver también la clave privada del certificado.
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
  sunat_cert_private_key_pem text,
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
         s.sunat_certificado_pem, s.sunat_cert_private_key_pem,
         h.serie_factura::text, h.serie_boleta::text,
         h.serie_nc_factura::text, h.serie_nd_factura::text,
         h.serie_nc_boleta::text, h.serie_nd_boleta::text
  FROM public.hoteles h
  LEFT JOIN private.hotel_secrets s ON s.hotel_id = h.id
  WHERE h.id = p_hotel_id AND auth.role() = 'service_role';
$$;
REVOKE ALL ON FUNCTION public.get_hotel_sunat_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_sunat_credentials(uuid) TO service_role;
