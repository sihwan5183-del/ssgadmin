-- 1) staff_product_goals: 입력 방식 + 비중 컬럼 추가
ALTER TABLE public.staff_product_goals
  ADD COLUMN IF NOT EXISTS goal_input_mode text NOT NULL DEFAULT 'count',
  ADD COLUMN IF NOT EXISTS goal_percent numeric NOT NULL DEFAULT 0;

ALTER TABLE public.staff_product_goals
  DROP CONSTRAINT IF EXISTS staff_product_goals_input_mode_chk;
ALTER TABLE public.staff_product_goals
  ADD CONSTRAINT staff_product_goals_input_mode_chk
  CHECK (goal_input_mode IN ('count','percent'));

-- 2) team_product_goals 테이블 신설
CREATE TABLE IF NOT EXISTS public.team_product_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team text NOT NULL,
  product text NOT NULL,
  sale_type text NOT NULL DEFAULT '__all',
  goal_type text NOT NULL DEFAULT 'count',
  year_month text NOT NULL,
  goal_input_mode text NOT NULL DEFAULT 'count',
  goal_count integer NOT NULL DEFAULT 0,
  goal_percent numeric NOT NULL DEFAULT 0,
  goal_value numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_product_goals_input_mode_chk CHECK (goal_input_mode IN ('count','percent')),
  CONSTRAINT team_product_goals_unique UNIQUE (team, product, sale_type, goal_type, year_month)
);

ALTER TABLE public.team_product_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view team_product_goals" ON public.team_product_goals;
CREATE POLICY "Authenticated can view team_product_goals"
  ON public.team_product_goals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins/leads insert team_product_goals" ON public.team_product_goals;
CREATE POLICY "Admins/leads insert team_product_goals"
  ON public.team_product_goals FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_team_lead(auth.uid()) OR is_planner(auth.uid()));

DROP POLICY IF EXISTS "Admins/leads update team_product_goals" ON public.team_product_goals;
CREATE POLICY "Admins/leads update team_product_goals"
  ON public.team_product_goals FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_team_lead(auth.uid()) OR is_planner(auth.uid()));

DROP POLICY IF EXISTS "Admins/leads delete team_product_goals" ON public.team_product_goals;
CREATE POLICY "Admins/leads delete team_product_goals"
  ON public.team_product_goals FOR DELETE TO authenticated
  USING (is_admin(auth.uid()) OR is_ceo(auth.uid()) OR is_team_lead(auth.uid()) OR is_planner(auth.uid()));

DROP TRIGGER IF EXISTS update_team_product_goals_updated_at ON public.team_product_goals;
CREATE TRIGGER update_team_product_goals_updated_at
  BEFORE UPDATE ON public.team_product_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_team_product_goals_ym ON public.team_product_goals(year_month);
CREATE INDEX IF NOT EXISTS idx_team_product_goals_team ON public.team_product_goals(team);