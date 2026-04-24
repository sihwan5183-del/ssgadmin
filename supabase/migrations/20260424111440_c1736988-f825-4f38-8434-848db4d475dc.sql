-- 1) 기존 자동 admin 부여 함수/트리거 모두 제거 (CASCADE)
DROP FUNCTION IF EXISTS public.auto_grant_admin_udak() CASCADE;
DROP FUNCTION IF EXISTS public.auto_grant_admin_h860306() CASCADE;
DROP FUNCTION IF EXISTS public.auto_grant_admin_h860306_naver() CASCADE;

-- 2) h860306@naver.com 자동 admin 부여 함수 + 트리거 신규 생성
CREATE OR REPLACE FUNCTION public.auto_grant_admin_h860306_naver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF lower(NEW.email) = 'h860306@naver.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.profiles SET status = 'active' WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_grant_admin_h860306_naver
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.auto_grant_admin_h860306_naver();

-- 3) 박태진 외 모든 admin/ceo/planner 권한 회수
DELETE FROM public.user_roles
WHERE role IN ('admin'::app_role, 'ceo'::app_role, 'planner'::app_role)
  AND user_id <> '1d19490f-b4ad-4d9e-84b8-62acb48590be';

-- 4) 박태진 권한/상태 보강
INSERT INTO public.user_roles (user_id, role)
VALUES ('1d19490f-b4ad-4d9e-84b8-62acb48590be', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET status = 'active'
WHERE user_id = '1d19490f-b4ad-4d9e-84b8-62acb48590be';

-- 5) 박태진 외 active 사용자는 모두 pending 으로 강제 전환
UPDATE public.profiles
SET status = 'pending'
WHERE user_id <> '1d19490f-b4ad-4d9e-84b8-62acb48590be'
  AND status = 'active';