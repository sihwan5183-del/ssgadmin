CREATE TABLE public.field_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(field, value)
);

CREATE INDEX idx_field_options_field ON public.field_options(field);

ALTER TABLE public.field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view field_options"
ON public.field_options FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert field_options"
ON public.field_options FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update field_options"
ON public.field_options FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete field_options"
ON public.field_options FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_field_options_updated_at
BEFORE UPDATE ON public.field_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 시드
INSERT INTO public.field_options (field, value, sort_order) VALUES
  ('channel','모요',1),('channel','유닥',2),('channel','오프라인',3),('channel','캠페인',4),('channel','당근',5),('channel','도그마루',6),('channel','SEG활동',7),('channel','기타',8),
  ('product','모바일',1),('product','USIM MNP',2),('product','세컨',3),('product','인터넷',4),('product','TV프리',5),('product','IOT',6),('product','대명',7),('product','홈',8),
  ('sale_type','MNP',1),('sale_type','신규',2),('sale_type','기변',3),('sale_type','USIM MNP',4),
  ('open_method','선개통',1),('open_method','후개통',2),
  ('status','개통완료',1),('status','예약',2),('status','보류',3),('status','취소',4),
  ('rate_plan','프리미어 에센셜',1),('rate_plan','프리미어 레귤러',2),('rate_plan','프리미어 플러스',3),('rate_plan','5G 시그니처',4),('rate_plan','5G 스탠다드',5),('rate_plan','LTE 프리미엄',6),('rate_plan','wearable',7),
  ('delivery_type','택배발송',1),('delivery_type','퀵배송',2),('delivery_type','매장방문',3),('delivery_type','직접전달',4),
  ('bank','국민',1),('bank','신한',2),('bank','우리',3),('bank','하나',4),('bank','농협',5),('bank','기업',6),('bank','카카오뱅크',7),('bank','토스뱅크',8),
  ('media','네이버',1),('media','메타(페이스북/인스타)',2),('media','유튜브',3),('media','인스타',4),('media','당근',5),('media','토스',6),('media','카카오',7),('media','구글',8),('media','기타',9);