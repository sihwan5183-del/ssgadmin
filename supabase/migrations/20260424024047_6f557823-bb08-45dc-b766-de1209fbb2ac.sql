-- ============ SEG Partners (업체 마스터) ============
CREATE TABLE public.seg_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT '법인', -- 법인 / 개인사업자 / 기타
  contract_type TEXT, -- MOU, 전단지, 공동구매, 제휴, 기타
  contract_date DATE,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  address TEXT,
  contract_detail TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active / paused / ended
  assignee UUID, -- 담당 직원 user_id
  assignee_name TEXT,
  note TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seg_partners_status ON public.seg_partners(status);
CREATE INDEX idx_seg_partners_assignee ON public.seg_partners(assignee);
CREATE INDEX idx_seg_partners_company ON public.seg_partners(company_name);

ALTER TABLE public.seg_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view seg_partners" ON public.seg_partners
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own seg_partners" ON public.seg_partners
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin update seg_partners" ON public.seg_partners
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assignee OR is_admin(auth.uid()) OR is_planner(auth.uid()));
CREATE POLICY "Owner or admin delete seg_partners" ON public.seg_partners
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()) OR is_planner(auth.uid()));

CREATE TRIGGER update_seg_partners_updated_at
  BEFORE UPDATE ON public.seg_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEG Activities (활동 이력) ============
CREATE TABLE public.seg_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.seg_partners(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_time TIME,
  activity_type TEXT NOT NULL DEFAULT '방문', -- 방문 / 전화 / 제안 / 계약 / 사후관리 / 이벤트 / 기타
  title TEXT,
  content TEXT,
  next_action_date DATE,
  next_action_note TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  assignee UUID,
  assignee_name TEXT,
  location TEXT,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seg_activities_partner ON public.seg_activities(partner_id);
CREATE INDEX idx_seg_activities_date ON public.seg_activities(activity_date);
CREATE INDEX idx_seg_activities_next ON public.seg_activities(next_action_date) WHERE next_action_date IS NOT NULL;
CREATE INDEX idx_seg_activities_assignee ON public.seg_activities(assignee);
CREATE INDEX idx_seg_activities_completed ON public.seg_activities(is_completed);

ALTER TABLE public.seg_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view seg_activities" ON public.seg_activities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own seg_activities" ON public.seg_activities
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner or admin update seg_activities" ON public.seg_activities
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR auth.uid() = assignee OR is_admin(auth.uid()) OR is_planner(auth.uid()));
CREATE POLICY "Owner or admin delete seg_activities" ON public.seg_activities
  FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR is_admin(auth.uid()) OR is_planner(auth.uid()));

CREATE TRIGGER update_seg_activities_updated_at
  BEFORE UPDATE ON public.seg_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 완료 토글 시 completed_at 자동 동기화
CREATE OR REPLACE FUNCTION public.sync_seg_activity_completed()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_completed = true AND (OLD.is_completed IS DISTINCT FROM true) THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.is_completed = false THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_seg_activity_completed
  BEFORE UPDATE OR INSERT ON public.seg_activities
  FOR EACH ROW EXECUTE FUNCTION public.sync_seg_activity_completed();

-- ============ SEG Attachments (첨부파일) ============
CREATE TABLE public.seg_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.seg_partners(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.seg_activities(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  doc_type TEXT, -- 계약서 / 전단지 / 현장사진 / 기타
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seg_attachments_target_check CHECK (partner_id IS NOT NULL OR activity_id IS NOT NULL)
);

CREATE INDEX idx_seg_attachments_partner ON public.seg_attachments(partner_id);
CREATE INDEX idx_seg_attachments_activity ON public.seg_attachments(activity_id);

ALTER TABLE public.seg_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view seg_attachments" ON public.seg_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own seg_attachments" ON public.seg_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Owner or admin delete seg_attachments" ON public.seg_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR is_admin(auth.uid()) OR is_planner(auth.uid()));

-- ============ Storage bucket ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('seg-files', 'seg-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth view seg-files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'seg-files');
CREATE POLICY "Auth upload seg-files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'seg-files');
CREATE POLICY "Auth update own seg-files" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'seg-files' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Auth delete own or admin seg-files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'seg-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid())));