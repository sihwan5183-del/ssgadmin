
-- 1) Add explicit opt-in columns
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS plan_change_planned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan_change_target_plan text,
  ADD COLUMN IF NOT EXISTS vas1_action text,
  ADD COLUMN IF NOT EXISTS vas2_action text;

-- vas action: NULL = unspecified, 'keep' = retain, 'remove' = schedule cancellation
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS sales_vas1_action_chk,
  DROP CONSTRAINT IF EXISTS sales_vas2_action_chk;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_vas1_action_chk CHECK (vas1_action IS NULL OR vas1_action IN ('keep','remove')),
  ADD CONSTRAINT sales_vas2_action_chk CHECK (vas2_action IS NULL OR vas2_action IN ('keep','remove'));

-- 2) Plan-change trigger: only fire when toggle is ON
CREATE OR REPLACE FUNCTION public.compute_plan_change_due_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_days INTEGER;
  v_contract TEXT;
  v_has_distributor BOOLEAN;
  v_key TEXT;
BEGIN
  IF NEW.plan_change_completed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- 명시적 토글이 OFF면 캘린더 대상에서 제외
  IF COALESCE(NEW.plan_change_planned, false) = false THEN
    NEW.plan_change_due_date := NULL;
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
$function$;

-- Make sure trigger fires when toggle changes
DROP TRIGGER IF EXISTS trg_compute_plan_change_due_date ON public.sales;
CREATE TRIGGER trg_compute_plan_change_due_date
BEFORE INSERT OR UPDATE OF sale_type, open_date, custom_fields, distributor_amount, plan_change_completed_at, plan_change_planned
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.compute_plan_change_due_date();

-- 3) Addon-tasks trigger: only generate tasks for addons explicitly marked 'remove'
CREATE OR REPLACE FUNCTION public.sync_sales_addon_tasks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_days INTEGER;
BEGIN
  -- 미완료 작업만 재계산(이력 보존)
  DELETE FROM public.sales_addon_tasks
   WHERE sale_id = NEW.id AND completed_at IS NULL;

  IF NEW.open_date IS NULL THEN RETURN NEW; END IF;

  -- VAS1
  IF NEW.vas1 IS NOT NULL AND length(trim(NEW.vas1)) > 0
     AND NEW.vas1_action = 'remove' THEN
    SELECT retention_days INTO v_days
      FROM public.addon_retention_rules
     WHERE addon_name = NEW.vas1 AND active = true LIMIT 1;
    IF v_days IS NOT NULL THEN
      INSERT INTO public.sales_addon_tasks (sale_id, addon_name, due_date)
      VALUES (NEW.id, NEW.vas1, NEW.open_date + v_days)
      ON CONFLICT (sale_id, addon_name) DO UPDATE
        SET due_date = EXCLUDED.due_date, completed_at = NULL,
            completed_by = NULL, completed_note = NULL;
    END IF;
  END IF;

  -- VAS2
  IF NEW.vas2 IS NOT NULL AND length(trim(NEW.vas2)) > 0
     AND NEW.vas2_action = 'remove' THEN
    SELECT retention_days INTO v_days
      FROM public.addon_retention_rules
     WHERE addon_name = NEW.vas2 AND active = true LIMIT 1;
    IF v_days IS NOT NULL THEN
      INSERT INTO public.sales_addon_tasks (sale_id, addon_name, due_date)
      VALUES (NEW.id, NEW.vas2, NEW.open_date + v_days)
      ON CONFLICT (sale_id, addon_name) DO UPDATE
        SET due_date = EXCLUDED.due_date, completed_at = NULL,
            completed_by = NULL, completed_note = NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_sales_addon_tasks ON public.sales;
CREATE TRIGGER trg_sync_sales_addon_tasks
AFTER INSERT OR UPDATE OF vas1, vas2, vas1_action, vas2_action, open_date
ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.sync_sales_addon_tasks();

-- 4) Clean up legacy auto-generated tasks (keep completed history)
DELETE FROM public.sales_addon_tasks t
 USING public.sales s
 WHERE t.sale_id = s.id
   AND t.completed_at IS NULL
   AND NOT (
     (s.vas1 = t.addon_name AND s.vas1_action = 'remove') OR
     (s.vas2 = t.addon_name AND s.vas2_action = 'remove')
   );

-- 5) Recompute plan_change_due_date so legacy rows without toggle get cleared
UPDATE public.sales SET open_date = open_date WHERE plan_change_due_date IS NOT NULL;
