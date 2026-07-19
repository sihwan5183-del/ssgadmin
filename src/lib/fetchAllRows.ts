// ============================================================
// Supabase 전체 행 조회 헬퍼
// ============================================================
// Supabase 프로젝트의 API 설정(Max Rows)이 요청당 반환 가능한 행 수를
// 서버 단에서 강제로 제한할 수 있어, 클라이언트에서 아무리 큰 .limit()을
// 걸어도 조용히 잘려나갈 수 있다.
//
// 이 헬퍼는 .range() 기반으로 페이지를 끝까지 순회하며 데이터를 모두 모은다.
// 서버 Max Rows 설정값이 얼마든 상관없이, 조건에 맞는 행을 전부 가져온다.
//
// 사용 예:
//   const rows = await fetchAllRows<Sale>(({ from, to }) =>
//     supabase
//       .from("sales")
//       .select("id, customer_name, open_date")
//       .eq("approval_status", "승인")
//       .order("open_date", { ascending: false })
//       .range(from, to)
//   );
//
// 주의: buildQuery 콜백 마지막에 반드시 .range(from, to)를 붙여서 반환할 것.
//       (.limit()은 쓰지 않는다 — range가 페이지 경계를 담당한다)

export interface FetchAllRowsResult<T> {
  data: T[] | null;
  error: any;
}

export async function fetchAllRows<T = any>(
  buildQuery: (page: { from: number; to: number }) => PromiseLike<FetchAllRowsResult<T>>,
  pageSize = 1000
): Promise<T[]> {
  let all: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery({ from, to: from + pageSize - 1 });
    if (error) throw error;
    const chunk = data ?? [];
    all = all.concat(chunk);
    if (chunk.length < pageSize) break; // 더 가져올 데이터 없음
    from += pageSize;
  }

  return all;
}
