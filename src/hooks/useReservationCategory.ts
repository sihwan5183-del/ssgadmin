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
import { useState, useEffect, useCallback } from 'react';

export type ReservationCategory = 'foldable' | 'iphone18';

export interface ReservationTableNames {
  reservations: string;
  statusLogs: string;
  memoLogs: string;
  label: string;
}

const STORAGE_KEY = 'ssg_reservation_category';

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

function readStoredCategory(): ReservationCategory {
  if (typeof window === 'undefined') return 'foldable';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'iphone18' ? 'iphone18' : 'foldable';
}

export function useReservationCategory() {
  const [category, setCategoryState] = useState<ReservationCategory>(readStoredCategory);

  // 다른 탭에서 카테고리를 바꾼 경우에도 동기화
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'foldable' || e.newValue === 'iphone18')) {
        setCategoryState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCategory = useCallback((next: ReservationCategory) => {
    setCategoryState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return {
    category,
    setCategory,
    tables: RESERVATION_CATEGORY_TABLES[category],
  };
}
