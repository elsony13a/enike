
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.publishers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  app_id TEXT NOT NULL UNIQUE,
  secret_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publishers TO authenticated;
GRANT ALL ON public.publishers TO service_role;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publishers view own" ON public.publishers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Publishers insert own" ON public.publishers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Publishers update own" ON public.publishers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.ad_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  postback_secure_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_networks TO authenticated;
GRANT ALL ON public.ad_networks TO service_role;
ALTER TABLE public.ad_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read active networks" ON public.ad_networks FOR SELECT TO authenticated USING (is_active = true);

CREATE TABLE public.publisher_postbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  postback_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publisher_postbacks TO authenticated;
GRANT ALL ON public.publisher_postbacks TO service_role;
ALTER TABLE public.publisher_postbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publishers manage own postbacks" ON public.publisher_postbacks FOR ALL TO authenticated
  USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()))
  WITH CHECK (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  network_name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  trans_id TEXT NOT NULL,
  reward_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  payout NUMERIC(12,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success','duplicate','pending','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (network_name, trans_id)
);
CREATE INDEX idx_transactions_publisher ON public.transactions(publisher_id, created_at DESC);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Publishers view own transactions" ON public.transactions FOR SELECT TO authenticated
  USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.gen_app_id() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public, extensions AS $$
  SELECT 'app_' || lower(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
$$;

CREATE OR REPLACE FUNCTION public.gen_secret_key() RETURNS TEXT
LANGUAGE sql VOLATILE SET search_path = public, extensions AS $$
  SELECT encode(extensions.gen_random_bytes(24), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.handle_new_publisher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.publishers (user_id, name, email, app_id, secret_key, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    public.gen_app_id(),
    public.gen_secret_key(),
    'active'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_publisher
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_publisher();
