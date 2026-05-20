
CREATE TABLE public.custom_proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  change_date DATE NOT NULL DEFAULT CURRENT_DATE,
  manager TEXT,
  customer_join_number TEXT,
  customer_name TEXT,
  prev_fee NUMERIC NOT NULL DEFAULT 0,
  prev_select_discount BOOLEAN NOT NULL DEFAULT false,
  new_fee NUMERIC NOT NULL DEFAULT 0,
  new_select_discount BOOLEAN NOT NULL DEFAULT false,
  pure_upsell NUMERIC NOT NULL DEFAULT 0,
  final_upsell NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View custom_proposals by scope"
  ON public.custom_proposals FOR SELECT
  TO authenticated
  USING (can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Insert own custom_proposals"
  ON public.custom_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Update custom_proposals by scope"
  ON public.custom_proposals FOR UPDATE
  TO authenticated
  USING (can_view_user_data(auth.uid(), created_by));

CREATE POLICY "Delete custom_proposals by owner or admin"
  ON public.custom_proposals FOR DELETE
  TO authenticated
  USING ((auth.uid() = created_by) OR is_admin(auth.uid()) OR is_ceo(auth.uid()));

CREATE TRIGGER update_custom_proposals_updated_at
  BEFORE UPDATE ON public.custom_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_custom_proposals_change_date ON public.custom_proposals(change_date DESC);
CREATE INDEX idx_custom_proposals_created_by ON public.custom_proposals(created_by);
