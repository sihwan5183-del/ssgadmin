-- 사이드바에서 [요금제 변경 캘린더] 메뉴 제거 — [검수 관리] 내부 탭으로 통합됨
DELETE FROM public.menu_items WHERE path = '/plan-change-calendar';
