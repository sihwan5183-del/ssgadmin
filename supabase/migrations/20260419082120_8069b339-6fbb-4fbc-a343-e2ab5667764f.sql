-- 광고 캠페인 테이블
CREATE TABLE public.ad_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  media TEXT NOT NULL,
  topic TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_budget NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  landing_url TEXT,
  channel TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT '진행중',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 일별 KPI/지출 (선택적 — 일별 추적용)
CREATE TABLE public.ad_campaign_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, log_date)
);

CREATE INDEX idx_ad_campaigns_dates ON public.ad_campaigns(start_date, end_date);
CREATE INDEX idx_ad_campaign_daily_campaign ON public.ad_campaign_daily(campaign_id);
CREATE INDEX idx_ad_campaign_daily_date ON public.ad_campaign_daily(log_date);

-- RLS
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_campaign_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view campaigns"
  ON public.ad_campaigns FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert campaigns"
  ON public.ad_campaigns FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) AND auth.uid() = created_by);

CREATE POLICY "Admins update campaigns"
  ON public.ad_campaigns FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete campaigns"
  ON public.ad_campaigns FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view daily"
  ON public.ad_campaign_daily FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert daily"
  ON public.ad_campaign_daily FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update daily"
  ON public.ad_campaign_daily FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete daily"
  ON public.ad_campaign_daily FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- updated_at 트리거
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_campaign_daily_updated_at
  BEFORE UPDATE ON public.ad_campaign_daily
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 광고 소재 이미지 버킷 (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-creatives', 'ad-creatives', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Ad creatives publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ad-creatives');

CREATE POLICY "Admins upload ad creatives"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-creatives' AND is_admin(auth.uid()));

CREATE POLICY "Admins update ad creatives"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'ad-creatives' AND is_admin(auth.uid()));

CREATE POLICY "Admins delete ad creatives"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ad-creatives' AND is_admin(auth.uid()));