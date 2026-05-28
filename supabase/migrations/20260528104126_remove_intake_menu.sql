-- 인입 관리 메뉴 항목 제거 (잠재고객 관리 내부 탭으로 통합)
DELETE FROM public.menu_items WHERE path = '/channel-intake';
