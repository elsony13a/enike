
CREATE POLICY "Anon can view active offers" ON public.offers
  FOR SELECT TO anon
  USING (is_active = true);

CREATE POLICY "Anon read active networks" ON public.ad_networks
  FOR SELECT TO anon
  USING (is_active = true);

GRANT SELECT ON public.offers TO anon;
GRANT SELECT ON public.ad_networks TO anon;
