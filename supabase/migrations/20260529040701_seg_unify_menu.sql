-- 좌측 사이드바: SEG 활동 관리 단일 메뉴로 통합
DELETE FROM public.menu_items
WHERE path IN ('/seg-calendar', '/apartment');

UPDATE public.menu_items
SET label = 'SEG. 활동 관리',
    sort_order = 1,
    updated_at = now()
WHERE path = '/seg-partners';
