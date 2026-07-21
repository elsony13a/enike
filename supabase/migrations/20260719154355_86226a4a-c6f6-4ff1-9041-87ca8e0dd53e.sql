CREATE POLICY "Admins view all publishers"
  ON public.publishers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all transactions"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins view all networks"
  ON public.ad_networks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));