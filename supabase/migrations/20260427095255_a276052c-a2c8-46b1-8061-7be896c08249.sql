-- 1) Add fixed_expense_type field for admin-managed options (no schema change needed; field_options.field is text)
-- Seed a few defaults so the dropdown isn't empty
INSERT INTO public.field_options (field, value, sort_order, active)
VALUES
  ('fixed_expense_type', '어도비 구독료', 10, true),
  ('fixed_expense_type', '렌탈비', 20, true),
  ('fixed_expense_type', '정수기', 30, true),
  ('fixed_expense_type', '통신비', 40, true),
  ('fixed_expense_type', 'SaaS 구독', 50, true)
ON CONFLICT DO NOTHING;

-- 2) Recurring (auto monthly) expenses template table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  expense_type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  vendor TEXT,
  note TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  auto_register BOOLEAN NOT NULL DEFAULT true,
  day_of_month INTEGER NOT NULL DEFAULT 1,
  last_generated_month TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view recurring_expenses"
  ON public.recurring_expenses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own recurring_expenses"
  ON public.recurring_expenses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own or admin recurring_expenses"
  ON public.recurring_expenses FOR UPDATE TO authenticated
  USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE POLICY "Users delete own or admin recurring_expenses"
  ON public.recurring_expenses FOR DELETE TO authenticated
  USING ((auth.uid() = created_by) OR is_admin(auth.uid()));

CREATE TRIGGER trg_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();