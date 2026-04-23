
-- Add field_mapping column to budget_categories
-- This maps each category to a sales table field or a computed value
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS field_mapping text DEFAULT NULL;

-- Add description column for admin clarity
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS description text DEFAULT NULL;

-- Delete old generic seed data and re-seed with detailed items
DELETE FROM public.budget_categories;

-- 지출 항목 (Expense items mapped to sales fields)
INSERT INTO public.budget_categories (category_type, label, field_mapping, description, sort_order, dashboard_included, active) VALUES
  ('지출', '유통망지원금',     'distributor_amount',    '판매원장 → 유통망지원금 필드 합산',           1, true, true),
  ('지출', '현금개통 비용',    'cash_support_amount',   '판매원장 → 현금지원금 필드 합산',            2, true, true),
  ('지출', '추가보조금',       'extra_subsidy',         '판매원장 → 추가보조금 필드 합산',            3, true, true),
  ('지출', '고객입금액(반환금)', 'receivable_amount',   '판매원장 → 수납금액 필드 합산',              4, true, true),
  ('지출', '모요 수수료',      'moyo_fee',              '모요 채널 적용건수 × 88,000원 (자동 계산)',  5, true, true),
  ('지출', '광고비',           'ad_spend',              '지출장표(ad_spend) 전체 합산',               6, true, true),
  ('지출', '기타 지출',        NULL,                    '수동 입력 기타 비용',                        7, false, true);

-- 수익 항목 (Revenue items mapped to sales fields)
INSERT INTO public.budget_categories (category_type, label, field_mapping, description, sort_order, dashboard_included, active) VALUES
  ('수익', '단가표 기본 수수료', 'unit_price',          '판매원장 → 단가(수수료) 필드 합산',          1, true, true),
  ('수익', '부가서비스 수수료',  'vas_fee',             '판매원장 → VAS 수수료 필드 합산',            2, true, true),
  ('수익', 'Net 수수료',        'net_fee',              '판매원장 → 순수수료 필드 합산',              3, true, true),
  ('수익', '기타 수익',         NULL,                   '수동 입력 기타 수익',                        4, false, true);
