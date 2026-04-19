-- 광고비(매체별 지출) 테이블
CREATE TABLE public.ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  spend_date DATE NOT NULL,
  spend_month TEXT,
  media TEXT NOT NULL,
  channel TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  campaign TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ad_spend_date ON public.ad_spend(spend_date);
CREATE INDEX idx_ad_spend_media ON public.ad_spend(media);
CREATE INDEX idx_ad_spend_channel ON public.ad_spend(channel);

ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view all ad_spend"
ON public.ad_spend FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own ad_spend"
ON public.ad_spend FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own ad_spend"
ON public.ad_spend FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users delete own ad_spend"
ON public.ad_spend FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE TRIGGER update_ad_spend_updated_at
BEFORE UPDATE ON public.ad_spend
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();