
CREATE TABLE public.field_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.field_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view field_teams"
  ON public.field_teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert field_teams"
  ON public.field_teams FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE POLICY "Admins can update field_teams"
  ON public.field_teams FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE POLICY "Admins can delete field_teams"
  ON public.field_teams FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_ceo(auth.uid()));

CREATE TRIGGER trg_field_teams_updated
  BEFORE UPDATE ON public.field_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
