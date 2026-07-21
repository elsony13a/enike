
-- Extend ad_networks with feed URL + points conversion
ALTER TABLE public.ad_networks
  ADD COLUMN IF NOT EXISTS offer_feed_url text,
  ADD COLUMN IF NOT EXISTS points_per_dollar numeric NOT NULL DEFAULT 1000;

-- Extend transactions to support click matching + point crediting
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS click_id text,
  ADD COLUMN IF NOT EXISTS points_awarded numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS transactions_click_id_idx ON public.transactions(click_id);

-- Offers catalog
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_id uuid REFERENCES public.ad_networks(id) ON DELETE CASCADE,
  network_name text NOT NULL,
  offer_id text NOT NULL,
  title text NOT NULL,
  description text,
  payout numeric NOT NULL DEFAULT 0,
  image_url text,
  target_country text,
  tracking_url text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network_name, offer_id)
);

GRANT SELECT ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;

ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active offers"
  ON public.offers FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage offers insert"
  ON public.offers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage offers update"
  ON public.offers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage offers delete"
  ON public.offers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Postback logs (admin-visible)
CREATE TABLE IF NOT EXISTS public.postback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network_name text,
  publisher_id uuid REFERENCES public.publishers(id) ON DELETE SET NULL,
  placement_id uuid REFERENCES public.placements(id) ON DELETE SET NULL,
  click_id text,
  payout numeric,
  points_awarded numeric,
  status text,
  raw_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified boolean NOT NULL DEFAULT false,
  response_code int NOT NULL DEFAULT 200,
  response_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.postback_logs TO authenticated;
GRANT ALL ON public.postback_logs TO service_role;

ALTER TABLE public.postback_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view postback logs"
  ON public.postback_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Publishers can view their postback logs"
  ON public.postback_logs FOR SELECT
  TO authenticated
  USING (
    publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid())
  );

-- updated_at trigger for offers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS offers_set_updated_at ON public.offers;
CREATE TRIGGER offers_set_updated_at
  BEFORE UPDATE ON public.offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
