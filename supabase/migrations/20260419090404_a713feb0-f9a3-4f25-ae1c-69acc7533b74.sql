
-- ============================================================
-- 1. 실적 변경 이력 (audit log)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sales_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action TEXT NOT NULL,            -- INSERT | UPDATE | DELETE
  changes JSONB NOT NULL DEFAULT '{}'::jsonb  -- { field: { old, new } }
);

ALTER TABLE public.sales_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view audit"
  ON public.sales_audit_log FOR SELECT TO authenticated USING (true);
-- INSERT는 트리거(SECURITY DEFINER)에서만, 사용자 직접 insert는 막음

CREATE INDEX IF NOT EXISTS idx_audit_sale ON public.sales_audit_log (sale_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.sales_audit_log (changed_at DESC);

-- 변경 추적 트리거
CREATE OR REPLACE FUNCTION public.log_sales_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes JSONB := '{}'::jsonb;
  v_key TEXT;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sales_audit_log (sale_id, changed_by, action, changes)
    VALUES (NEW.id, NEW.created_by, 'INSERT', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    FOR v_key IN SELECT jsonb_object_keys(v_new) LOOP
      IF v_key IN ('updated_at') THEN CONTINUE; END IF;
      IF (v_old->v_key) IS DISTINCT FROM (v_new->v_key) THEN
        v_changes := v_changes || jsonb_build_object(v_key,
          jsonb_build_object('old', v_old->v_key, 'new', v_new->v_key));
      END IF;
    END LOOP;
    IF v_changes <> '{}'::jsonb THEN
      INSERT INTO public.sales_audit_log (sale_id, changed_by, action, changes)
      VALUES (NEW.id, auth.uid(), 'UPDATE', v_changes);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.sales_audit_log (sale_id, changed_by, action, changes)
    VALUES (OLD.id, auth.uid(), 'DELETE', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_sales_changes ON public.sales;
CREATE TRIGGER trg_log_sales_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.log_sales_changes();

-- ============================================================
-- 2. 가입 서류 메타 (sale_documents)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,        -- bucket 내부 경로
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  doc_type TEXT,                     -- 신분증, 가입신청서, 자동이체 등
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view sale_documents"
  ON public.sale_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own sale_documents"
  ON public.sale_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Owner or admin update sale_documents"
  ON public.sale_documents FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR is_admin(auth.uid()));
CREATE POLICY "Owner or admin delete sale_documents"
  ON public.sale_documents FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sale_documents_sale ON public.sale_documents (sale_id);

-- ============================================================
-- 3. 알림 (notifications) — 인앱
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL,
  kind TEXT NOT NULL,                -- 'document_uploaded' | 'transfer_pending' ...
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,                         -- 클릭 시 이동할 라우트
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Recipients view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients delete own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);
-- INSERT는 트리거(SECURITY DEFINER)와 관리자만
CREATE POLICY "Admins insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR auth.uid() = recipient_id);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON public.notifications (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON public.notifications (recipient_id) WHERE read_at IS NULL;

-- 서류 업로드 → 모든 관리자에게 알림
CREATE OR REPLACE FUNCTION public.notify_admins_on_document_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer TEXT;
BEGIN
  SELECT customer_name INTO v_customer FROM public.sales WHERE id = NEW.sale_id;
  INSERT INTO public.notifications (recipient_id, kind, title, message, link, metadata)
  SELECT
    ur.user_id,
    'document_uploaded',
    '새 가입 서류 업로드',
    COALESCE(v_customer, '고객') || ' · ' || NEW.file_name,
    '/activities?sale=' || NEW.sale_id,
    jsonb_build_object('sale_id', NEW.sale_id, 'document_id', NEW.id)
  FROM public.user_roles ur
  WHERE ur.role = 'admin' AND ur.user_id <> NEW.uploaded_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_doc_upload ON public.sale_documents;
CREATE TRIGGER trg_notify_doc_upload
  AFTER INSERT ON public.sale_documents
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_document_upload();

-- ============================================================
-- 4. Storage 버킷: sale-documents (비공개)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('sale-documents', 'sale-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 인증 사용자만 다운로드 (signed URL 또는 인증 세션 필요)
CREATE POLICY "Authenticated can read sale-documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sale-documents');

-- 업로드: 인증 사용자
CREATE POLICY "Authenticated can upload sale-documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sale-documents');

-- 업로드한 본인 또는 관리자만 수정/삭제
CREATE POLICY "Owner or admin update sale-documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'sale-documents' AND (owner = auth.uid() OR is_admin(auth.uid())));

CREATE POLICY "Owner or admin delete sale-documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sale-documents' AND (owner = auth.uid() OR is_admin(auth.uid())));
