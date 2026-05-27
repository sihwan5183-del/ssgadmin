
-- leads 테이블
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name TEXT,
  phone TEXT,
  current_carrier TEXT,
  desired_device TEXT,
  desired_product TEXT,
  campaign_name TEXT,
  status TEXT NOT NULL DEFAULT '신규 접수',
  memo TEXT,
  assigned_to UUID,
  source TEXT
);

CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view leads"
  ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert leads"
  ON public.leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update leads"
  ON public.leads FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete leads"
  ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()) OR public.is_planner(auth.uid()));

CREATE TRIGGER leads_set_updated
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- lead_notes 테이블 (상담 이력)
CREATE TABLE public.lead_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_notes_lead ON public.lead_notes(lead_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;

ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead notes"
  ON public.lead_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert lead notes"
  ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id OR author_id IS NULL);
CREATE POLICY "Authors can update own lead notes"
  ON public.lead_notes FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "Authors or admins can delete lead notes"
  ON public.lead_notes FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR public.is_admin(auth.uid()));

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_notes;

-- 사이드바 메뉴 등록
INSERT INTO public.menu_items (group_id, label, path, icon, sort_order, visible_roles, active, is_admin_only)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '잠재고객 관리',
  '/leads',
  'UserCheck',
  20,
  ARRAY['admin','manager','user']::text[],
  true,
  false
);
