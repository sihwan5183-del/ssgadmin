ALTER TABLE public.product_rate_plans
  ADD COLUMN IF NOT EXISTS linked_vas text[] NOT NULL DEFAULT '{}'::text[];