-- 1) 신규 가입 프로필을 즉시 active 로 생성
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
    'active'
  );
  RETURN NEW;
END;
$function$;

-- 2) profiles.status 기본값도 active 로
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'active';

-- 3) 기존 pending 사용자 일괄 active 승격 (테스트/초기 세팅 기간)
UPDATE public.profiles SET status = 'active' WHERE status = 'pending';