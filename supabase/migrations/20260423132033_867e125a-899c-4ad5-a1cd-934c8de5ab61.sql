
ALTER TABLE public.product_rate_plans
  ADD COLUMN IF NOT EXISTS vas_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vas1_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vas2_locked boolean NOT NULL DEFAULT false;
