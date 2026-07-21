CREATE TABLE public.placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  site_url text NOT NULL,
  app_id text NOT NULL UNIQUE DEFAULT public.gen_app_id(),
  secret_key text NOT NULL DEFAULT public.gen_secret_key(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.placements TO authenticated;
GRANT ALL ON public.placements TO service_role;
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own placements" ON public.placements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all placements" ON public.placements FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS offer_name text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS country text;