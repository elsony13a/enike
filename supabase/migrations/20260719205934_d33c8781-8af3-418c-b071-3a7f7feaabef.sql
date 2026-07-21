
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS offer_id text;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check
  CHECK (status = ANY (ARRAY['success','duplicate','pending','rejected','clicked','credited','completed']));

CREATE INDEX IF NOT EXISTS transactions_user_offer_idx
  ON public.transactions (user_id, offer_id, status);
