GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;
GRANT ALL ON public.placements TO service_role;
GRANT EXECUTE ON FUNCTION public.gen_app_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_secret_key() TO authenticated;