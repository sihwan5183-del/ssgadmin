/**
 * 대시보드 위젯 전반에서 사용할 단일 집계 기준 (Source of Truth)
 * - 개통일(open_date)이 기간 내 존재하는 건만 "개통"으로 인정
 * - 취소/개통취소/반려 제외
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const EXCLUDED_ACTIVATION_STATUSES = ["취소", "개통취소", "반려"];

/**
 * sales 쿼리에 표준 활성/개통 필터 적용
 * @param query supabase from("sales").select(...) 체인
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 */
export function applyActivationFilter<T extends any>(
  query: T,
  startDate: string,
  endDate: string,
): T {
  let q: any = query;
  q = q.gte("open_date", startDate).lte("open_date", endDate);
  for (const s of EXCLUDED_ACTIVATION_STATUSES) {
    q = q.neq("status", s);
  }
  return q as T;
}
