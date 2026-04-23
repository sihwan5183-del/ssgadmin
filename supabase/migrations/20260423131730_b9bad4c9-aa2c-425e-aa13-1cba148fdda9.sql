
ALTER TABLE public.budget_categories
  ADD COLUMN IF NOT EXISTS is_included_in_base boolean NOT NULL DEFAULT false;

-- 부가서비스 수수료는 기본적으로 단가표에 포함된 것으로 설정
UPDATE public.budget_categories
  SET is_included_in_base = true
  WHERE field_mapping = 'vas_fee';
