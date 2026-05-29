/**
 * 대시보드 위젯 전반에서 사용할 단일 집계 기준 (Source of Truth)
 * - 개통일(open_date)이 기간 내 존재하는 건만 "개통"으로 인정
 * - 취소/개통취소/반려 제외
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const EXCLUDED_ACTIVATION_STATUSES = ["취소", "개통취소", "반려"];

/**
 * 실적으로 인정되는 최종 마감 상태 (Source of Truth)
 * - 개통완료 / 설치완료 / 변경완료(업셀용) 만 '실적'으로 카운트
 * - 택배발송 / 청약완료 / 개통대기 등 중간 단계는 실적에서 제외 (거품 실적 제거)
 */
export const COMPLETED_ACTIVATION_STATUSES = [
  "개통완료",
  "설치완료",
  "변경완료(업셀용)",
];

/** 미개통 대기 (실적 미인정) 상태 — [미개통 대기 상품 보드] 집계 대상 */
export const PENDING_ACTIVATION_STATUSES = ["택배발송", "청약완료"];

/**
 * sales 쿼리에 표준 '실적(개통완료/설치완료)' 화이트리스트 필터 적용
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
  q = q.in("status", COMPLETED_ACTIVATION_STATUSES);
  return q as T;
}

/**
 * 미개통 대기(택배발송/청약완료) 화이트리스트 필터 — 실적 미인정 분류용
 *
 * NOTE: '택배발송' / '청약완료' 상태는 아직 개통이 되지 않은 상태라
 * open_date 가 NULL 인 경우가 대부분이다. (개통 시점에 비로소 open_date 가 채워짐)
 * 따라서 period 필터는 created_at(등록일자) 기준으로 적용한다.
 */
export function applyPendingActivationFilter<T extends any>(
  query: T,
  startDate: string,
  endDate: string,
): T {
  let q: any = query;
  q = q.in("status", PENDING_ACTIVATION_STATUSES);
  // 등록일자 기준 기간 (yyyy-mm-dd) → created_at 의 해당 일자 범위
  q = q.gte("created_at", `${startDate}T00:00:00`).lte("created_at", `${endDate}T23:59:59.999`);
  return q as T;
}
