-- 1) sales 테이블에 미처리 항목 컬럼 추가
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS pending_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_note text,
  ADD COLUMN IF NOT EXISTS pending_resolved boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approval_override_reason text;

-- 2) pending_resolved 자동 동기화: pending_items 가 비어있으면 true, 아니면 false
CREATE OR REPLACE FUNCTION public.sync_pending_resolved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pending_items IS NULL OR jsonb_array_length(NEW.pending_items) = 0 THEN
    NEW.pending_resolved := true;
  ELSE
    -- 변경되어 새로 들어온 경우 false 로, 이미 사용자가 resolved=true 로 명시 변경한 경우엔 그대로 유지
    IF TG_OP = 'INSERT' THEN
      NEW.pending_resolved := false;
    ELSIF (OLD.pending_items IS DISTINCT FROM NEW.pending_items) AND (OLD.pending_resolved = NEW.pending_resolved) THEN
      NEW.pending_resolved := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_pending_resolved ON public.sales;
CREATE TRIGGER trg_sync_pending_resolved
BEFORE INSERT OR UPDATE OF pending_items, pending_resolved ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.sync_pending_resolved();

-- 3) 인덱스: 미처리 필터 가속
CREATE INDEX IF NOT EXISTS idx_sales_pending_resolved ON public.sales(pending_resolved) WHERE pending_resolved = false;