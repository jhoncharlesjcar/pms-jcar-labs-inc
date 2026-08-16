-- Move legacy secrets out of the REST-exposed hotel row.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.hotel_secrets (
  hotel_id uuid PRIMARY KEY REFERENCES public.hoteles(id) ON DELETE CASCADE,
  sunat_clave_sol text,
  sunat_certificado_pem text,
  pasarela_private_key text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.hotel_secrets FROM PUBLIC, anon, authenticated;

INSERT INTO private.hotel_secrets(hotel_id, sunat_clave_sol, sunat_certificado_pem, pasarela_private_key)
SELECT id, sunat_clave_sol, sunat_certificado_pem, pasarela_private_key
FROM public.hoteles
ON CONFLICT (hotel_id) DO UPDATE SET
  sunat_clave_sol = COALESCE(EXCLUDED.sunat_clave_sol, private.hotel_secrets.sunat_clave_sol),
  sunat_certificado_pem = COALESCE(EXCLUDED.sunat_certificado_pem, private.hotel_secrets.sunat_certificado_pem),
  pasarela_private_key = COALESCE(EXCLUDED.pasarela_private_key, private.hotel_secrets.pasarela_private_key),
  updated_at = now();

UPDATE public.hoteles
SET sunat_clave_sol = NULL,
    sunat_certificado_pem = NULL,
    pasarela_private_key = NULL
WHERE sunat_clave_sol IS NOT NULL
   OR sunat_certificado_pem IS NOT NULL
   OR pasarela_private_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.block_public_hotel_secret_writes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    NEW.sunat_clave_sol := NULLIF(btrim(NEW.sunat_clave_sol), '');
    NEW.sunat_certificado_pem := NULLIF(btrim(NEW.sunat_certificado_pem), '');
    NEW.pasarela_private_key := NULLIF(btrim(NEW.pasarela_private_key), '');
    IF TG_OP = 'INSERT' AND (
      NEW.sunat_clave_sol IS NOT NULL OR NEW.sunat_certificado_pem IS NOT NULL OR NEW.pasarela_private_key IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'hotel secrets must be configured through a server-side endpoint';
    ELSIF TG_OP = 'UPDATE' AND (
      NEW.sunat_clave_sol IS DISTINCT FROM OLD.sunat_clave_sol
      OR NEW.sunat_certificado_pem IS DISTINCT FROM OLD.sunat_certificado_pem
      OR NEW.pasarela_private_key IS DISTINCT FROM OLD.pasarela_private_key
    ) THEN
      RAISE EXCEPTION 'hotel secrets must be configured through a server-side endpoint';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_block_public_hotel_secret_writes ON public.hoteles;
CREATE TRIGGER trg_block_public_hotel_secret_writes
  BEFORE INSERT OR UPDATE ON public.hoteles FOR EACH ROW
  EXECUTE FUNCTION public.block_public_hotel_secret_writes();
REVOKE ALL ON FUNCTION public.block_public_hotel_secret_writes() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_hotel_sunat_credentials(p_hotel_id uuid)
RETURNS TABLE(
  id uuid, nombre text, ruc text, direccion text, ciudad text, aplica_igv boolean,
  sunat_usuario_sol text, sunat_clave_sol text, sunat_modo_prueba boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
  SELECT h.id, h.nombre::text, h.ruc::text, h.direccion::text, h.ciudad::text, h.aplica_igv,
         h.sunat_usuario_sol::text, s.sunat_clave_sol, h.sunat_modo_prueba
  FROM public.hoteles h
  LEFT JOIN private.hotel_secrets s ON s.hotel_id = h.id
  WHERE h.id = p_hotel_id AND auth.role() = 'service_role';
$$;
REVOKE ALL ON FUNCTION public.get_hotel_sunat_credentials(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_hotel_sunat_credentials(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.set_hotel_secrets(
  p_hotel_id uuid,
  p_sunat_clave_sol text DEFAULT NULL,
  p_sunat_certificado_pem text DEFAULT NULL,
  p_pasarela_private_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  INSERT INTO private.hotel_secrets(hotel_id, sunat_clave_sol, sunat_certificado_pem, pasarela_private_key)
  VALUES (
    p_hotel_id, NULLIF(btrim(p_sunat_clave_sol), ''),
    NULLIF(btrim(p_sunat_certificado_pem), ''), NULLIF(btrim(p_pasarela_private_key), '')
  )
  ON CONFLICT (hotel_id) DO UPDATE SET
    sunat_clave_sol = COALESCE(EXCLUDED.sunat_clave_sol, private.hotel_secrets.sunat_clave_sol),
    sunat_certificado_pem = COALESCE(EXCLUDED.sunat_certificado_pem, private.hotel_secrets.sunat_certificado_pem),
    pasarela_private_key = COALESCE(EXCLUDED.pasarela_private_key, private.hotel_secrets.pasarela_private_key),
    updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_hotel_secrets(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_hotel_secrets(uuid, text, text, text) TO service_role;
