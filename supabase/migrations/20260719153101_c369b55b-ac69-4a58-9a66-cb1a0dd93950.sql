
REVOKE EXECUTE ON FUNCTION public.handle_new_publisher() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_app_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gen_secret_key() FROM PUBLIC, anon, authenticated;
