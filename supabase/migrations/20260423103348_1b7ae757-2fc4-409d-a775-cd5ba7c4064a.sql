
CREATE TABLE public.budget_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_type text NOT NULL DEFAULT '지출' CHECK (category_type IN ('지출','수익')),
  label text NOT NULL,
  dashboard_included boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_type, label)
);

ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view budget_categories"
  ON public.budget_categories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert budget_categories"
  ON public.budget_categories FOR INSERT
  TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update budget_categories"
  ON public.budget_categories FOR UPDATE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete budget_categories"
  ON public.budget_categories FOR DELETE
  TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_budget_categories_updated_at
  BEFORE UPDATE ON public.budget_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default categories
INSERT INTO public.budget_categories (category_type, label, sort_order) VALUES
  ('지출', '광고비', 1),
  ('지출', '모요 수수료', 2),
  ('지출', '임대료', 3),
  ('지출', '인건비', 4),
  ('지출', '기타 지출', 5),
  ('수익', '리베이트', 1),
  ('수익', '부가서비스(VAS)', 2),
  ('수익', '기타 수익', 3);
