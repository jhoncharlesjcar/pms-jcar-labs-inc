-- Move the SUNAT encryption key out of the function body into Vault.
-- The current function value is copied server-side. This file must not contain the key.

DO $$
DECLARE
  v_current text;
BEGIN
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'sunat_encryption_key') THEN
    RETURN;
  END IF;

  BEGIN
    v_current := public.get_sunat_encryption_key();
  EXCEPTION WHEN OTHERS THEN
    v_current := NULL;
  END;

  IF v_current IS NULL OR length(v_current) < 16 THEN
    RAISE EXCEPTION 'sunat_encryption_key is not in vault and the current function has no key to copy';
  END IF;

  PERFORM vault.create_secret(v_current, 'sunat_encryption_key', 'SUNAT credential encryption key');
END $$;

CREATE OR REPLACE FUNCTION public.get_sunat_encryption_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO pg_catalog, public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT ds.decrypted_secret INTO v_key
  FROM vault.decrypted_secrets AS ds
  WHERE ds.name = 'sunat_encryption_key'
  LIMIT 1;

  IF v_key IS NULL OR length(v_key) < 16 THEN
    RAISE EXCEPTION 'sunat encryption key is not configured';
  END IF;

  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM anon;
REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_sunat_encryption_key() TO service_role;
