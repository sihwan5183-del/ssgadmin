CREATE OR REPLACE FUNCTION public.can_view_user_data(_viewer uuid, _target uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    -- 본인
    _viewer = _target
    -- 관리자/대표/기획팀/슈퍼관리자
    OR public.is_admin(_viewer)
    OR public.is_ceo(_viewer)
    OR public.is_planner(_viewer)
    OR public.is_super_admin(_viewer)
    -- 같은 팀 구성원: 일반 직원/팀장 모두 동일 팀이면 열람 허용
    OR (
      EXISTS (
        SELECT 1
          FROM public.profiles pv
          JOIN public.profiles pt ON pt.user_id = _target
         WHERE pv.user_id = _viewer
           AND pv.team IS NOT NULL
           AND pt.team IS NOT NULL
           AND pv.team = pt.team
      )
    );
$function$;