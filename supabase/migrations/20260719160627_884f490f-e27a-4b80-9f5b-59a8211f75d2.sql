
-- Payment settings per publisher
CREATE TABLE public.payment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_settings TO authenticated;
GRANT ALL ON public.payment_settings TO service_role;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own payment settings" ON public.payment_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all payment settings" ON public.payment_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Payout requests / history
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_id TEXT NOT NULL UNIQUE DEFAULT ('INV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10))),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payouts" ON public.payouts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own payouts" ON public.payouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all payouts" ON public.payouts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update payouts" ON public.payouts
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Profile extension for contact info
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS telegram TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;
