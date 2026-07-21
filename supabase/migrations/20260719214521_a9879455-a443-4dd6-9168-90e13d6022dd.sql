
CREATE TABLE public.user_balances (
  publisher_id uuid NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  balance_points bigint NOT NULL DEFAULT 0,
  total_earned_points bigint NOT NULL DEFAULT 0,
  total_credited_usd numeric(12,4) NOT NULL DEFAULT 0,
  last_credited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publisher_id, user_id)
);

GRANT SELECT ON public.user_balances TO authenticated;
GRANT ALL ON public.user_balances TO service_role;

ALTER TABLE public.user_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers view own balances" ON public.user_balances
  FOR SELECT TO authenticated
  USING (publisher_id IN (SELECT id FROM public.publishers WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all balances" ON public.user_balances
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_balances_updated_at
BEFORE UPDATE ON public.user_balances
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: when a transaction becomes credited/success, upsert & increment balance.
CREATE OR REPLACE FUNCTION public.tx_credit_user_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_credit_now boolean := NEW.status IN ('credited','success','completed');
  was_credit boolean := TG_OP = 'UPDATE' AND OLD.status IN ('credited','success','completed');
  pts bigint := COALESCE(NEW.points_awarded, 0)::bigint;
  usd numeric(12,4) := COALESCE(NEW.payout, 0);
BEGIN
  IF is_credit_now AND NOT was_credit AND pts > 0 THEN
    INSERT INTO public.user_balances (publisher_id, user_id, balance_points, total_earned_points, total_credited_usd, last_credited_at)
    VALUES (NEW.publisher_id, NEW.user_id, pts, pts, usd, now())
    ON CONFLICT (publisher_id, user_id) DO UPDATE
    SET balance_points = public.user_balances.balance_points + EXCLUDED.balance_points,
        total_earned_points = public.user_balances.total_earned_points + EXCLUDED.total_earned_points,
        total_credited_usd = public.user_balances.total_credited_usd + EXCLUDED.total_credited_usd,
        last_credited_at = now(),
        updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tx_credit_balance_ins
AFTER INSERT ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tx_credit_user_balance();

CREATE TRIGGER trg_tx_credit_balance_upd
AFTER UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tx_credit_user_balance();

-- Backfill from existing credited/success transactions
INSERT INTO public.user_balances (publisher_id, user_id, balance_points, total_earned_points, total_credited_usd, last_credited_at)
SELECT publisher_id, user_id,
       SUM(points_awarded)::bigint,
       SUM(points_awarded)::bigint,
       SUM(payout),
       MAX(created_at)
FROM public.transactions
WHERE status IN ('credited','success','completed') AND points_awarded > 0
GROUP BY publisher_id, user_id
ON CONFLICT (publisher_id, user_id) DO NOTHING;
