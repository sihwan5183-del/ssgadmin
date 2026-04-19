CREATE TABLE public.regulars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  channel TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  birth_date TEXT,
  manager TEXT,
  coupon_sent BOOLEAN NOT NULL DEFAULT false,
  converted BOOLEAN NOT NULL DEFAULT false,
  registered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.regulars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view regulars"
  ON public.regulars FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert regulars"
  ON public.regulars FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own regulars"
  ON public.regulars FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can delete their own regulars"
  ON public.regulars FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_regulars_updated_at
  BEFORE UPDATE ON public.regulars
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_regulars_channel ON public.regulars(channel);
CREATE INDEX idx_regulars_registered_date ON public.regulars(registered_date DESC);
CREATE INDEX idx_regulars_created_by ON public.regulars(created_by);