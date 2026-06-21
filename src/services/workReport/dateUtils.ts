// ============================================================
// dateUtils — KST 날짜 변환 공통 helper
// ============================================================

/**
 * KST 날짜 문자열(YYYY-MM-DD)을 UTC ISO 범위로 변환
 * 예) '2026-06-21' → { start: '2026-06-20T15:00:00.000Z', end: '2026-06-21T14:59:59.999Z' }
 */
export function getKstDateRangeUtc(from: string, to: string): { start: string; end: string } {
  const start = new Date(`${from}T00:00:00.000+09:00`).toISOString();
  const end   = new Date(`${to}T23:59:59.999+09:00`).toISOString();
  return { start, end };
}

/**
 * KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getKstTodayString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
