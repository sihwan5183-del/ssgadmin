ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS campaign_name text;

COMMENT ON COLUMN public.inquiries.campaign_name IS '광고 캠페인명 (메타광고, 도그마루 홈캠 등)'