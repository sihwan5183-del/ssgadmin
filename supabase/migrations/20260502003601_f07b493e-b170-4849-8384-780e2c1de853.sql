-- 1) profiles.force_logout_at 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS force_logout_at timestamptz;

-- 2) user_roles 변경 시 force_logout_at 갱신 함수
CREATE OR REPLACE FUNCTION public.bump_force_logout_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET force_logout_at = now()
   WHERE user_id = _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_user_roles_force_logout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.bump_force_logout_for_user(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.bump_force_logout_for_user(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_force_logout ON public.user_roles;
CREATE TRIGGER trg_user_roles_force_logout
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_roles_force_logout();

-- 3) profiles 핵심 필드 변경 시에도 force_logout_at 갱신 (단, force_logout_at 자체 변경은 제외)
CREATE OR REPLACE FUNCTION public.tg_profiles_force_logout_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- force_logout_at 만 바뀐 경우는 무한루프 방지
  IF (NEW.position IS DISTINCT FROM OLD.position)
     OR (NEW.store IS DISTINCT FROM OLD.store)
     OR (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.team IS DISTINCT FROM OLD.team)
  THEN
    NEW.force_logout_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_force_logout ON public.profiles;
CREATE TRIGGER trg_profiles_force_logout
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_profiles_force_logout_on_change();

-- 4) 기존 'planner' 권한 보유자 -> 'admin' 으로 일괄 마이그레이션
-- 먼저 admin 권한을 부여 (중복 시 무시)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'admin'::app_role
  FROM public.user_roles
 WHERE role = 'planner'
ON CONFLICT (user_id, role) DO NOTHING;

-- 그 후 planner 행 제거 (트리거가 force_logout_at 자동 갱신)
DELETE FROM public.user_roles WHERE role = 'planner';

-- 5) realtime 활성화 (force_logout_at 변경을 클라이언트에 즉시 푸시하기 위함)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;