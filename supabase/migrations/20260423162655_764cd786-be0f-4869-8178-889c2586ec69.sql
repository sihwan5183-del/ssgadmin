
-- Add new columns to incentive_rates for tiered pricing, pay type, and grade bonus
ALTER TABLE public.incentive_rates
  ADD COLUMN IF NOT EXISTS pay_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS pay_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiered_rates jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS grade_bonus jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.incentive_rates.pay_type IS 'fixed = 정액, percent = 정률(매출대비%)';
COMMENT ON COLUMN public.incentive_rates.pay_percent IS '정률 지급 시 비율 (예: 5.0 = 5%)';
COMMENT ON COLUMN public.incentive_rates.tiered_rates IS '계단식 단가 배열: [{"min_qty":30,"amount":10000},{"min_qty":40,"amount":15000}]';
COMMENT ON COLUMN public.incentive_rates.grade_bonus IS '그레이드별 추가 보너스: {"매장장":5000,"부매장장":3000}';
