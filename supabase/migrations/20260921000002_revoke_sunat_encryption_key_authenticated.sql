-- Secret-returning DEFINER must not be callable with the anon JWT.
REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM anon;
REVOKE ALL ON FUNCTION public.get_sunat_encryption_key() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_sunat_encryption_key() TO service_role;
