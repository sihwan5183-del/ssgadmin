
CREATE TABLE public.notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
    -- 'seg_d1' | 'seg_today' | 'sales_zero' | 'manual' | 'partner_assigned'
  enabled BOOLEAN NOT NULL DEFAULT true,
  send_time TEXT,            -- 'HH:MM' KST, NULL이면 시간 무관
  weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::smallint[],
    -- 0=일 ~ 6=토
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  link TEXT,
  audience TEXT NOT NULL DEFAULT 'auto',
    -- 'auto' | 'all' | 'dashboard_only'
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view notification_rules"
  ON public.notification_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert notification_rules"
  ON public.notification_rules FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins update notification_rules"
  ON public.notification_rules FOR UPDATE TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY "Admins delete notification_rules"
  ON public.notification_rules FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER trg_notification_rules_updated
  BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_rules
  (rule_key, label, description, trigger_type, send_time, weekdays, title_template, body_template, link, audience, sort_order)
VALUES
  ('seg_d1', '영업 일정 리마인드 (D-1)', '내일 영업 일정이 있는 담당자에게 전날 발송',
   'seg_d1', '18:00', ARRAY[1,2,3,4,5]::smallint[],
   '[내일 일정] {활동명}',
   '{직원이름}님, 내일 ''{활동명}'' 일정이 있습니다. 미리 준비하세요!',
   '/seg/calendar', 'auto', 10),
  ('sales_zero', '실적 입력 독려', '당일 실적 0건인 직원에게 정해진 시간에 발송',
   'sales_zero', '18:00', ARRAY[1,2,3,4,5]::smallint[],
   '[실적 미입력] 오늘 실적을 입력해 주세요',
   '{직원이름}님, 현재시간 {현재시간} 기준 오늘 등록된 실적이 없습니다. 잊지 말고 입력해 주세요.',
   '/input', 'dashboard_only', 20),
  ('urgent_notice', '긴급 공지 (즉시 발송)', '관리자가 즉시 전체 직원에게 푸시 발송',
   'manual', NULL, ARRAY[0,1,2,3,4,5,6]::smallint[],
   '[긴급 공지] {제목}',
   '{본문}',
   '/', 'all', 30),
  ('partner_assigned', '업체 배정 알림', '새 업체가 담당자에게 배정될 때 발송',
   'partner_assigned', NULL, ARRAY[0,1,2,3,4,5,6]::smallint[],
   '[업체 배정] {업체명}',
   '{직원이름}님, 새 업체 ''{업체명}''이 배정되었습니다.',
   '/seg/partners', 'auto', 40);
