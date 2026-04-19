ALTER TABLE public.ad_spend
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '광고비',
  ADD COLUMN IF NOT EXISTS expense_type TEXT;

CREATE INDEX IF NOT EXISTS idx_ad_spend_category ON public.ad_spend(category);

-- 기타지출 세부 항목 시드
INSERT INTO public.field_options (field, value, sort_order) VALUES
  ('expense_type','임대료',1),
  ('expense_type','통신비',2),
  ('expense_type','인건비',3),
  ('expense_type','운영비',4),
  ('expense_type','사무용품',5),
  ('expense_type','수수료',6),
  ('expense_type','교통/출장',7),
  ('expense_type','회식/접대',8),
  ('expense_type','기타',9)
ON CONFLICT (field, value) DO NOTHING;