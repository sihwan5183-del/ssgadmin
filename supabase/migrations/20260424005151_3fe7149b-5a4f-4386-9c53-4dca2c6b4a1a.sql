
-- 1) positions 마스터 테이블
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view positions" ON public.positions;
CREATE POLICY "Authenticated can view positions" ON public.positions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins insert positions" ON public.positions;
CREATE POLICY "Admins insert positions" ON public.positions
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update positions" ON public.positions;
CREATE POLICY "Admins update positions" ON public.positions
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete positions" ON public.positions;
CREATE POLICY "Admins delete positions" ON public.positions
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

DROP TRIGGER IF EXISTS positions_updated_at ON public.positions;
CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON public.positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 기본 직급 시드
INSERT INTO public.positions (name, sort_order)
VALUES ('대표',1),('이사',2),('점장',3),('팀장',4),('주임',5),('사원',6)
ON CONFLICT (name) DO NOTHING;

-- 2) profiles에 hire_date 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hire_date date;

-- 3) profiles.status에 suspended 허용
CREATE OR REPLACE FUNCTION public.validate_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active','leave','resigned','pending','suspended') THEN
    RAISE EXCEPTION '유효하지 않은 상태값: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
