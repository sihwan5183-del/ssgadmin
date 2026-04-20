
-- 1) 다운로드 기록 테이블
CREATE TABLE public.download_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL,
  label TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_count INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.download_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own download history"
  ON public.download_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Users insert own download history"
  ON public.download_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own download history"
  ON public.download_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own download history"
  ON public.download_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE INDEX idx_download_history_user_created
  ON public.download_history (user_id, created_at DESC);

-- 2) Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage RLS — 사용자별 폴더 (user_id/...)
CREATE POLICY "Users read own exports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users insert own exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own exports"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'exports' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role manages exports"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'exports') WITH CHECK (bucket_id = 'exports');

-- 4) 7일 지난 기록/파일 자동 정리 함수 (수동/cron 호출용)
CREATE OR REPLACE FUNCTION public.cleanup_old_download_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.download_history WHERE created_at < now() - interval '7 days';
END;
$$;
