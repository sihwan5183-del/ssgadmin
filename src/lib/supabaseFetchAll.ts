// ============================================================
// Supabase 전체 조회 헬퍼 — 1건당 최대 1000행 응답 제한 우회
// ============================================================
// Supabase(PostgREST) 기본 설정상 select 요청 1건은 최대 1000행까지만
// 돌려줍니다. leads/activity_logs/sales처럼 1000건을 넘는 테이블을
// "전체 기간" 등으로 필터 없이(혹은 넓게) 집계할 때 이 제한에 걸리면
// 일부 행이 조용히 누락된 채로 통계가 계산됩니다.
// 전체 집계가 필요한 곳에서는 반드시 이 헬퍼로 1000건씩 range를
// 끝까지 순회해서 가져와야 합니다. (reservationService.ts의
// fetchAllPaged와 동일한 패턴을 테이블 무관하게 재사용할 수 있게 분리)
import { supabase } from '@/integrations/supabase/client';

const CHUNK = 1000;

export async function fetchAllRows<T>(
  table: string,
  selectCols: string,
  applyFilters?: (q: any) => any,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += CHUNK) {
    const to = from + CHUNK - 1;
    // table이 리터럴 타입이 아닌 일반 string이라 supabase.from()의 오버로드 추론이
    // 깨지면서 결과 타입이 SelectQueryError로 오염되는 문제가 있어 any로 우회한다.
    // 실제 반환 타입은 호출부에서 지정하는 제네릭 <T>가 담당한다.
    let q: any = supabase.from(table as any).select(selectCols);
    if (applyFilters) q = applyFilters(q);
    // 정렬 없이 range()만 쓰면 청크 경계에서 행이 누락/중복될 수 있어(reservationService.ts
    // fetchAllPaged에서 실제로 발생했던 문제), id를 안정적인 타이브레이커로 항상 추가한다.
    q = q.order('id', { ascending: true });
    const { data, error } = await q.range(from, to);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < CHUNK) break;
  }
  return all;
}
