
-- Create incentive_policies table for custom policy builder
CREATE TABLE public.incentive_policies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  target_sale_types text[] NOT NULL DEFAULT '{}',
  target_products text[] NOT NULL DEFAULT '{}',
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  valid_from date,
  valid_to date,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incentive_policies ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated can view incentive_policies"
  ON public.incentive_policies FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins insert incentive_policies"
  ON public.incentive_policies FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update incentive_policies"
  ON public.incentive_policies FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete incentive_policies"
  ON public.incentive_policies FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_incentive_policies_updated_at
  BEFORE UPDATE ON public.incentive_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
