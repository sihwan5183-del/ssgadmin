// ============================================================
// 사전예약 카테고리(폴더블 / 아이폰18) 전역 토글
// ============================================================
// reservations(폴더블) / reservations_iphone(아이폰18)는 완전히 분리된
// 테이블입니다. 이 훅은 사용자가 마지막으로 선택한 카테고리를
// localStorage에 저장해두고, 사전예약 관련 모든 화면(목록/통계/확정발주/
// 실시간로그/응답시간/부재알림)이 같은 값을 읽어 어느 테이블을 볼지
// 일관되게 결정하도록 합니다. 화면마다 따로 상태를 들고 있으면 화면 간
// 이동 시 카테고리가 어긋나 다른 테이블을 보게 될 위험이 있어 반드시
// 이 훅을 통해서만 테이블 이름을 가져와야 합니다.
//
// v20260904: 토글 버튼(ReservationCategoryToggle)과 각 화면이 이 훅을
// "따로따로" 호출하고 있어서, 버튼을 눌러도 버튼 자신의 상태(+localStorage)만
// 바뀌고 정작 데이터를 불러오는 화면 쪽 인스턴스는 그 변화를 몰랐던 버그 수정.
// (localStorage의 `storage` 이벤트는 같은 탭 안에서는 발생하지 않는 브라우저
// 특성 때문에, 다른 탭 동기화용으로 걸어둔 storage 리스너만으로는 부족했음)
// → 같은 탭 안의 모든 훅 인스턴스에게도 커스텀 이벤트로 즉시 알려서 동기화한다.
import { useState, useEffect, useCallback } from 'react';

export type ReservationCategory = 'foldable' | 'iphone18';

export interface ReservationTableNames {
  reservations: string;
  statusLogs: string;
  memoLogs: string;
  label: string;
}

const STORAGE_KEY = 'ssg_reservation_category';
const CATEGORY_CHANGE_EVENT = 'ssg-reservation-category-change';

export const RESERVATION_CATEGORY_TABLES: Record<ReservationCategory, ReservationTableNames> = {
  foldable: {
    reservations: 'reservations',
    statusLogs: 'reservation_status_logs',
    memoLogs: 'reservation_memo_logs',
    label: '폴더블',
  },
  iphone18: {
    reservations: 'reservations_iphone',
    statusLogs: 'reservation_status_logs_iphone',
    memoLogs: 'reservation_memo_logs_iphone',
    label: '아이폰18',
  },
};

// 기본값은 아이폰18. 사용자가 명시적으로 '폴더블'을 선택해 저장해둔 경우에만 폴더블로 시작한다.
function readStoredCategory(): ReservationCategory {
  if (typeof window === 'undefined') return 'iphone18';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'foldable' ? 'foldable' : 'iphone18';
}

export function useReservationCategory() {
  const [category, setCategoryState] = useState<ReservationCategory>(readStoredCategory);

  useEffect(() => {
    // 다른 탭/창에서 카테고리를 바꾼 경우 동기화
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'foldable' || e.newValue === 'iphone18')) {
        setCategoryState(e.newValue);
      }
    };
    // 같은 탭 안의 다른 컴포넌트(토글 버튼 등)에서 바꾼 경우 동기화 — 핵심 수정 사항
    const onLocalChange = (e: Event) => {
      const next = (e as CustomEvent<ReservationCategory>).detail;
      if (next === 'foldable' || next === 'iphone18') setCategoryState(next);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CATEGORY_CHANGE_EVENT, onLocalChange as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CATEGORY_CHANGE_EVENT, onLocalChange as EventListener);
    };
  }, []);

  const setCategory = useCallback((next: ReservationCategory) => {
    setCategoryState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new CustomEvent(CATEGORY_CHANGE_EVENT, { detail: next }));
  }, []);

  return {
    category,
    setCategory,
    tables: RESERVATION_CATEGORY_TABLES[category],
  };
}
