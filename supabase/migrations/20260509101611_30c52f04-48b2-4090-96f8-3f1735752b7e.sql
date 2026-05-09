
-- 요금제 변경 가능일 자동계산 로직 정교화
CREATE OR REPLACE FUNCTION public.compute_plan_change_due_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_days INTEGER;
  v_contract TEXT;
  v_has_distributor BOOLEAN;
  v_key TEXT;
BEGIN
  -- 사용자가 수동으로 완료 처리한 행은 보존
  IF NEW.plan_change_completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.open_date IS NULL THEN
    NEW.plan_change_due_date := NULL;
    RETURN NEW;
  END IF;

  v_contract := NULLIF(trim(COALESCE(NEW.custom_fields->>'contract_type', '')), '');
  v_has_distributor := COALESCE(NEW.distributor_amount, 0) > 0;

  IF v_contract IS NULL THEN
    NEW.plan_change_due_date := NULL;
    RETURN NEW;
  END IF;

  -- 정확히 일치하는 키 만들기
  IF v_contract = '선택약정' THEN
    v_key := CASE WHEN v_has_distributor THEN '선택약정+유통망지원금' ELSE '선택약정' END;
  ELSIF v_contract = '이통사지원금' THEN
    v_key := CASE WHEN v_has_distributor THEN '이통사지원금+유통망지원금' ELSE '이통사지원금(공시)' END;
  ELSE
    v_key := v_contract;
  END IF;

  SELECT retention_days INTO v_days
    FROM public.plan_retention_rules
   WHERE sale_type = v_key AND active = true
   LIMIT 1;

  IF v_days IS NULL THEN
    NEW.plan_change_due_date := NULL;
  ELSE
    NEW.plan_change_due_date := NEW.open_date + v_days;
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 발화 컬럼 확장 (custom_fields, distributor_amount, plan_change_completed_at 변경 시에도 동작)
DROP TRIGGER IF EXISTS trg_compute_plan_change_due ON public.sales;
CREATE TRIGGER trg_compute_plan_change_due
BEFORE INSERT OR UPDATE OF sale_type, open_date, custom_fields, distributor_amount, plan_change_completed_at
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.compute_plan_change_due_date();

-- 과거 데이터 일괄 재계산 (트리거가 fire 되도록 open_date 자기 자신으로 update)
UPDATE public.sales
   SET open_date = open_date
 WHERE open_date IS NOT NULL
   AND plan_change_completed_at IS NULL;

-- 요금제 변경 가능일 인덱스 (캘린더 조회 가속)
CREATE INDEX IF NOT EXISTS idx_sales_plan_change_due_date
  ON public.sales(plan_change_due_date)
  WHERE plan_change_due_date IS NOT NULL;
