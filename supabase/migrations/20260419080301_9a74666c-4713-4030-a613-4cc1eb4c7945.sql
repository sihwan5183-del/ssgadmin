CREATE TABLE public.product_rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product text NOT NULL,
  rate_plan text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (product, rate_plan)
);

ALTER TABLE public.product_rate_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view product_rate_plans"
ON public.product_rate_plans FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert product_rate_plans"
ON public.product_rate_plans FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update product_rate_plans"
ON public.product_rate_plans FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete product_rate_plans"
ON public.product_rate_plans FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER update_product_rate_plans_updated_at
BEFORE UPDATE ON public.product_rate_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_product_rate_plans_product ON public.product_rate_plans(product) WHERE active = true;