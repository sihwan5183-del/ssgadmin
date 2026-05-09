
-- DB 1: 아파트 게시 활동
CREATE TABLE public.apartment_postings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team TEXT,
  apartment_name TEXT NOT NULL,
  location_detail TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  note TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apt_postings_end_date ON public.apartment_postings(end_date);
CREATE INDEX idx_apt_postings_team ON public.apartment_postings(team);

ALTER TABLE public.apartment_postings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View apt_postings by scope" ON public.apartment_postings
  FOR SELECT TO authenticated
  USING (public.can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Insert own apt_postings" ON public.apartment_postings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Update apt_postings by scope" ON public.apartment_postings
  FOR UPDATE TO authenticated
  USING (public.can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Delete apt_postings by owner or admin" ON public.apartment_postings
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE TRIGGER trg_apt_postings_updated
  BEFORE UPDATE ON public.apartment_postings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- DB 2: 인입 고객
CREATE TABLE public.apartment_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  posting_id UUID REFERENCES public.apartment_postings(id) ON DELETE SET NULL,
  team TEXT,
  apartment_name TEXT,
  inquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  current_carrier TEXT,
  inquiry_note TEXT,
  result_status TEXT NOT NULL DEFAULT '상담중',
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_apt_leads_posting ON public.apartment_leads(posting_id);
CREATE INDEX idx_apt_leads_status ON public.apartment_leads(result_status);
CREATE INDEX idx_apt_leads_inquiry_date ON public.apartment_leads(inquiry_date);

ALTER TABLE public.apartment_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View apt_leads by scope" ON public.apartment_leads
  FOR SELECT TO authenticated
  USING (public.can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Insert own apt_leads" ON public.apartment_leads
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Update apt_leads by scope" ON public.apartment_leads
  FOR UPDATE TO authenticated
  USING (public.can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Delete apt_leads by owner or admin" ON public.apartment_leads
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE TRIGGER trg_apt_leads_updated
  BEFORE UPDATE ON public.apartment_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
