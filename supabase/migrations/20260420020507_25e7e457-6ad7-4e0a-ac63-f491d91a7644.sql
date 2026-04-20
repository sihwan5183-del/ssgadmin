-- 1. enum 값 추가 (각각 단독 명령)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ceo';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'planner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'team_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. profiles 컬럼 확장
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS store TEXT,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- status 체크 (트리거로 검증 - check 제약 대신)
CREATE OR REPLACE FUNCTION public.validate_profile_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('active','leave','resigned') THEN
    RAISE EXCEPTION '유효하지 않은 상태값: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_status_trg ON public.profiles;
CREATE TRIGGER validate_profile_status_trg
BEFORE INSERT OR UPDATE OF status ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_status();

-- 3. 비활성 직원 체크 함수 (클라이언트에서 로그인 직후 호출)
CREATE OR REPLACE FUNCTION public.is_user_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT status = 'active' FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    true
  );
$$;

-- 4. 관리자도 다른 사람 profiles 업데이트 가능하도록 정책 추가
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));