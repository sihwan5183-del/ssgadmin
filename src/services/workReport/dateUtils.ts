// ============================================================
// dateUtils — KST 날짜 변환 공통 helper
// ============================================================

/**
 * KST 날짜 문자열(YYYY-MM-DD)을 UTC ISO 범위로 변환
 * 예) '2026-06-21' → { start: '2026-06-20T15:00:00.000Z', end: '2026-06-21T14:59:59.999Z' }
 */
export function getKstDateRangeUtc(from: string, to: string): { start: string; end: string } {
  // 빈 값 방어: 직접선택 시 customFrom/customTo가 빈 문자열일 수 있음
  const safeFrom = from && from.length === 10 ? from : new Date().toISOString().slice(0, 10);
  const safeTo   = to   && to.length   === 10 ? to   : safeFrom;
  const startMs = new Date(`${safeFrom}T00:00:00.000+09:00`);
  const endMs   = new Date(`${safeTo}T23:59:59.999+09:00`);
  if (isNaN(startMs.getTime()) || isNaN(endMs.getTime())) {
    const now = new Date().toISOString();
    return { start: now, end: now };
  }
  return { start: startMs.toISOString(), end: endMs.toISOString() };
}

/**
 * KST 기준 오늘 날짜 문자열 (YYYY-MM-DD)
 */
export function getKstTodayString(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
