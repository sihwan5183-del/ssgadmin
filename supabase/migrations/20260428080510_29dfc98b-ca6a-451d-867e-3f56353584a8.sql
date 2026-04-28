ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspicious_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_is_suspicious ON public.sales(is_suspicious) WHERE is_suspicious = true;