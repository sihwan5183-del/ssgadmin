
ALTER TABLE public.incentive_policies
  ADD COLUMN IF NOT EXISTS calc_method text NOT NULL DEFAULT 'tiered',
  ADD COLUMN IF NOT EXISTS fixed_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS match_model text;
