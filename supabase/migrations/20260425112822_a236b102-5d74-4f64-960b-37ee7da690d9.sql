CREATE TABLE public.equipment_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'settop',
  carrier TEXT,
  model_code TEXT,
  monthly_rental NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view equipment_catalog"
ON public.equipment_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert equipment_catalog"
ON public.equipment_catalog FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update equipment_catalog"
ON public.equipment_catalog FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete equipment_catalog"
ON public.equipment_catalog FOR DELETE TO authenticated USING (is_admin(auth.uid()));

CREATE TRIGGER equipment_catalog_updated_at
BEFORE UPDATE ON public.equipment_catalog
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER equipment_catalog_audit
AFTER INSERT OR UPDATE OR DELETE ON public.equipment_catalog
FOR EACH ROW EXECUTE FUNCTION public.log_master_changes();

CREATE INDEX idx_equipment_catalog_active_sort ON public.equipment_catalog(active, sort_order);
CREATE INDEX idx_equipment_catalog_category ON public.equipment_catalog(category);