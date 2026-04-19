CREATE TABLE public.incentive_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'combo',
  match_sale_type TEXT,
  match_product TEXT,
  match_model TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  valid_from DATE,
  valid_to DATE,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incentive_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view incentive_rates"
  ON public.incentive_rates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert incentive_rates"
  ON public.incentive_rates FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update incentive_rates"
  ON public.incentive_rates FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete incentive_rates"
  ON public.incentive_rates FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE TRIGGER trg_incentive_rates_updated_at
  BEFORE UPDATE ON public.incentive_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_incentive_rates_active ON public.incentive_rates(active);
CREATE INDEX idx_incentive_rates_match ON public.incentive_rates(match_sale_type, match_product, match_model);