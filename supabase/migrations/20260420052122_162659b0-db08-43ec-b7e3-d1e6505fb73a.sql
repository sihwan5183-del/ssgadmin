-- 엑셀 업로드 배치 기록 테이블
CREATE TABLE public.upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  template_version TEXT,
  mapping_preset TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  error_report JSONB NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upload_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own or admin upload_batches"
  ON public.upload_batches FOR SELECT TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin(auth.uid()));

CREATE POLICY "Users insert own upload_batches"
  ON public.upload_batches FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users update own upload_batches"
  ON public.upload_batches FOR UPDATE TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin(auth.uid()));

CREATE POLICY "Owner or admin delete upload_batches"
  ON public.upload_batches FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR public.is_admin(auth.uid()));

CREATE INDEX idx_upload_batches_user_created ON public.upload_batches(uploaded_by, created_at DESC);
CREATE INDEX idx_upload_batches_table ON public.upload_batches(table_name, created_at DESC);