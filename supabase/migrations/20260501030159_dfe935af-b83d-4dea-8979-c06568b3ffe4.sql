-- Add audit columns for regulars edit tracking
ALTER TABLE public.regulars
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- Trigger to auto-update updated_at and updated_by on row update
CREATE OR REPLACE FUNCTION public.tg_regulars_set_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_regulars_set_updated ON public.regulars;
CREATE TRIGGER trg_regulars_set_updated
BEFORE UPDATE ON public.regulars
FOR EACH ROW
EXECUTE FUNCTION public.tg_regulars_set_updated();