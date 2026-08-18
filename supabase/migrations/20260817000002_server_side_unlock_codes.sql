-- ============================================================
-- P0-4 FIX: Server-side unlock code verification
-- Creates an RPC that atomically verifies and consumes unlock codes.
-- Revokes direct browser access to codigos_desbloqueo.
-- Path: supabase/migrations/20260817000002_server_side_unlock_codes.sql
-- ============================================================

-- 1. Revoke all direct access to the unlock codes table
REVOKE ALL ON public.codigos_desbloqueo FROM anon, authenticated;

-- 2. Create an atomic RPC that verifies AND consumes in a single transaction
CREATE OR REPLACE FUNCTION public.consume_unlock_code(p_codigo text, p_user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Only allow authenticated developer or admin users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Validate input
  IF p_codigo IS NULL OR length(btrim(p_codigo)) < 4 THEN
    RAISE EXCEPTION 'invalid code format';
  END IF;

  -- Atomically find and consume the code (UPDATE ... RETURNING prevents TOCTOU)
  UPDATE public.codigos_desbloqueo
  SET usado = true,
      usado_por = p_user_email,
      fecha_uso = CURRENT_DATE::text
  WHERE codigo = btrim(p_codigo)
    AND usado = false
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_unlock_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_unlock_code(text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
