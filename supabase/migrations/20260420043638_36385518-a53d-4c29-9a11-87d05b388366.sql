-- 1) 인입(문의) 테이블
CREATE TABLE public.inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  content TEXT,
  manager TEXT,
  status TEXT NOT NULL DEFAULT '문의중',
  converted_sale_id UUID,
  note TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inquiries_date ON public.inquiries(inquiry_date DESC);
CREATE INDEX idx_inquiries_channel ON public.inquiries(channel);
CREATE INDEX idx_inquiries_status ON public.inquiries(status);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view inquiries"
  ON public.inquiries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users insert own inquiries"
  ON public.inquiries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own or admin/planner inquiries"
  ON public.inquiries FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()) OR is_planner(auth.uid()));

CREATE POLICY "Users delete own or admin inquiries"
  ON public.inquiries FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE TRIGGER trg_inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) 인입 채널 시드 (field_options.field='inquiry_channel')
INSERT INTO public.field_options (field, value, sort_order, active) VALUES
  ('inquiry_channel', '당근', 1, true),
  ('inquiry_channel', '네이버 플레이스', 2, true),
  ('inquiry_channel', '인스타그램', 3, true),
  ('inquiry_channel', '지인소개', 4, true),
  ('inquiry_channel', '전화문의', 5, true),
  ('inquiry_channel', '방문', 6, true),
  ('inquiry_channel', '기타', 99, true)
ON CONFLICT DO NOTHING;