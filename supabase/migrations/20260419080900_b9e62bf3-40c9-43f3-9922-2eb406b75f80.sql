CREATE TABLE public.device_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  model TEXT NOT NULL,
  serial_no TEXT,
  color TEXT,
  capacity TEXT,
  status TEXT NOT NULL DEFAULT '재고',
  stock_in_date DATE DEFAULT CURRENT_DATE,
  purchase_price NUMERIC DEFAULT 0,
  supplier TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_inventory_status ON public.device_inventory(status);
CREATE INDEX idx_device_inventory_model ON public.device_inventory(model);
CREATE INDEX idx_device_inventory_serial ON public.device_inventory(serial_no);

ALTER TABLE public.device_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view device_inventory"
  ON public.device_inventory FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users insert own device_inventory"
  ON public.device_inventory FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users update own or admin device_inventory"
  ON public.device_inventory FOR UPDATE
  TO authenticated USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE POLICY "Users delete own or admin device_inventory"
  ON public.device_inventory FOR DELETE
  TO authenticated USING (auth.uid() = created_by OR is_admin(auth.uid()));

CREATE TRIGGER update_device_inventory_updated_at
  BEFORE UPDATE ON public.device_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();