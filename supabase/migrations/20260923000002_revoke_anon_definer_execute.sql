-- Anon must not execute tenant helpers or the unlock-code consumer.
-- CREATE OR REPLACE does not clear PUBLIC/anon grants, so revoke explicitly.

REVOKE ALL ON FUNCTION public.get_user_hotel_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_hotel_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_user_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_user_active(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_unlock_code(text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_user_hotel_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_hotel_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_user_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_unlock_code(text, text) TO authenticated, service_role;
