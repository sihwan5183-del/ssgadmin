-- Add converted_at column to regulars (auto-set when converted toggles on)
ALTER TABLE public.regulars
  ADD COLUMN IF NOT EXISTS converted_at timestamptz;

-- Backfill: any already-converted rows get a stamp
UPDATE public.regulars
   SET converted_at = COALESCE(converted_at, created_at)
 WHERE converted = true AND converted_at IS NULL;

-- Trigger: maintain converted_at automatically
CREATE OR REPLACE FUNCTION public.sync_regular_converted_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.converted = true AND NEW.converted_at IS NULL THEN
      NEW.converted_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.converted = true AND (OLD.converted IS DISTINCT FROM true) THEN
      NEW.converted_at := COALESCE(NEW.converted_at, now());
    ELSIF NEW.converted = false THEN
      NEW.converted_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_regular_converted_at ON public.regulars;
CREATE TRIGGER trg_sync_regular_converted_at
BEFORE INSERT OR UPDATE ON public.regulars
FOR EACH ROW EXECUTE FUNCTION public.sync_regular_converted_at();