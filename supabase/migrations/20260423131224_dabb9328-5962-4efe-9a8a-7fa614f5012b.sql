
ALTER TABLE public.product_rate_plans
  ADD COLUMN IF NOT EXISTS default_sale_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_vas1 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_vas2 text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vas1_duration integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS vas2_duration integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS allowed_sale_types text[] DEFAULT '{}';
