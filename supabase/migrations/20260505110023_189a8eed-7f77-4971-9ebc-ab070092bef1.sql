-- 1. 기존 데이터 정제: 미완료 건의 개통일을 NULL 처리
UPDATE public.sales
SET open_date = NULL,
    open_month = NULL
WHERE open_date IS NOT NULL
  AND (status IS NULL OR status NOT IN ('개통완료', '설치완료'));

-- 2. 상태에 따라 개통일 자동 정합성 보장 트리거
CREATE OR REPLACE FUNCTION public.enforce_open_date_by_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('개통완료', '설치완료') THEN
    NEW.open_date := NULL;
    NEW.open_month := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_open_date_by_status ON public.sales;
CREATE TRIGGER trg_enforce_open_date_by_status
BEFORE INSERT OR UPDATE OF status, open_date ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.enforce_open_date_by_status();