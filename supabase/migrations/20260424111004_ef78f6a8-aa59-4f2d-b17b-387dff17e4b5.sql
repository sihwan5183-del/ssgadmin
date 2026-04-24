-- 신규 가입자는 기본 'pending' 상태로 (관리자 승인 필요)
-- 단, 자동 admin 부여 대상(udak@daum.net, udka@daum.net) 은 기존 트리거가 active 로 덮어씀

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'pending'
  );
  RETURN NEW;
END;
$function$;

-- 박태진 계정 안전 보강 (이미 admin + active 이지만 멱등성 보장)
INSERT INTO public.user_roles (user_id, role)
VALUES ('1d19490f-b4ad-4d9e-84b8-62acb48590be', 'admin'::app_role)
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET status = 'active'
WHERE user_id = '1d19490f-b4ad-4d9e-84b8-62acb48590be';