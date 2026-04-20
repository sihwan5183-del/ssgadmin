-- 1) 헬퍼 함수: 기획팀(planner) 권한 / CEO 권한
CREATE OR REPLACE FUNCTION public.is_planner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'planner') OR public.has_role(_user_id, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_ceo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_user_id, 'ceo') OR public.has_role(_user_id, 'admin');
$$;

-- 2) sales 테이블 RLS 재정의
DROP POLICY IF EXISTS "Users update own unlocked or admin" ON public.sales;
DROP POLICY IF EXISTS "Users delete own unlocked or admin" ON public.sales;

-- 기획팀/관리자: lock 여부와 무관하게 항상 수정 가능 (단, lock=true 상태로 만들거나 해제하는 것은 별도 정책)
-- 직원: 본인이 만든 unlocked 건만 수정 가능
CREATE POLICY "Sales update by planner or owner-unlocked"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (
    public.is_planner(auth.uid())
    OR public.is_ceo(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );

-- 삭제: 기본은 기획팀/CEO만 가능 + 본인 unlocked 건은 본인 삭제
-- (전체삭제/대량 삭제는 ceo만 — 클라이언트에서 보호)
CREATE POLICY "Sales delete by ceo planner or owner-unlocked"
  ON public.sales FOR DELETE
  TO authenticated
  USING (
    public.is_ceo(auth.uid())
    OR public.is_planner(auth.uid())
    OR (auth.uid() = created_by AND locked = false)
  );

-- 3) sales 변경 시 planner_feed 알림 자동 발송 (기획팀 전원에게 broadcast)
CREATE OR REPLACE FUNCTION public.notify_planners_on_sale_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_actor uuid := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);
  v_actor_name text;
  v_kind text;
  v_title text;
  v_message text;
  v_link text;
BEGIN
  -- 행위자 이름
  SELECT display_name INTO v_actor_name FROM public.profiles WHERE user_id = v_actor LIMIT 1;
  v_actor_name := COALESCE(v_actor_name, '직원');

  IF TG_OP = 'INSERT' THEN
    v_kind := 'sale_created';
    v_title := '신규 실적 입력';
    v_message := v_actor_name || ' · ' || COALESCE(NEW.customer_name, '고객') || ' / ' || COALESCE(NEW.device_model, '');
  ELSIF TG_OP = 'UPDATE' THEN
    -- 재검수 요청 처리
    IF NEW.re_review_requested_at IS DISTINCT FROM OLD.re_review_requested_at AND NEW.re_review_requested_at IS NOT NULL THEN
      v_kind := 'sale_re_review';
      v_title := '재검수 요청';
      v_message := v_actor_name || ' · ' || COALESCE(NEW.customer_name, '고객') || ' 재검수 요청';
    ELSIF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
      -- 승인상태 변경은 기존 트리거가 처리하므로 스킵
      RETURN NEW;
    ELSE
      v_kind := 'sale_updated';
      v_title := '실적 수정됨';
      v_message := v_actor_name || ' · ' || COALESCE(NEW.customer_name, '고객') || ' / ' || COALESCE(NEW.device_model, '');
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  v_link := '/activities?sale=' || COALESCE(NEW.id::text, '');

  -- 모든 planner / admin / ceo 에게 broadcast (행위자 본인 제외)
  INSERT INTO public.notifications (recipient_id, kind, title, message, link, metadata)
  SELECT DISTINCT ur.user_id, v_kind, v_title, v_message, v_link,
    jsonb_build_object('sale_id', NEW.id, 'actor_id', v_actor, 'actor_name', v_actor_name)
  FROM public.user_roles ur
  WHERE ur.role IN ('planner','admin','ceo')
    AND ur.user_id <> v_actor;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_planners_on_sale_change ON public.sales;
CREATE TRIGGER trg_notify_planners_on_sale_change
AFTER INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.notify_planners_on_sale_change();

-- 4) realtime 활성화 (이미 되어있을 수도 있지만 idempotent)
ALTER TABLE public.sales REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.incentive_rates REPLICA IDENTITY FULL;
ALTER TABLE public.device_models REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.incentive_rates;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_models;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;