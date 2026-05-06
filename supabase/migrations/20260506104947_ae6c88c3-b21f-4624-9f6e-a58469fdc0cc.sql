
-- 알림 규칙 확장: 반복 주기/월별 일자/지점·직급 필터/조건 임계값
ALTER TABLE public.notification_rules
  ADD COLUMN IF NOT EXISTS repeat_type text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS month_days smallint[] NOT NULL DEFAULT '{}'::smallint[],
  ADD COLUMN IF NOT EXISTS store_filter text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS position_filter text[] NOT NULL DEFAULT '{}'::text[];

-- 새 트리거 타입(sales_threshold) 사용. conditions = { metric:'sales', op:'lt'|'gte', value: 5 }

-- 알림 메시지 템플릿 저장소
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title_template text NOT NULL,
  body_template text NOT NULL,
  link text,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view notification_templates" ON public.notification_templates;
CREATE POLICY "Authenticated view notification_templates"
  ON public.notification_templates FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins insert notification_templates" ON public.notification_templates;
CREATE POLICY "Admins insert notification_templates"
  ON public.notification_templates FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update notification_templates" ON public.notification_templates;
CREATE POLICY "Admins update notification_templates"
  ON public.notification_templates FOR UPDATE
  TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete notification_templates" ON public.notification_templates;
CREATE POLICY "Admins delete notification_templates"
  ON public.notification_templates FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

DROP TRIGGER IF EXISTS notification_templates_updated_at ON public.notification_templates;
CREATE TRIGGER notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
