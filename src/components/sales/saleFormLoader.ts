// 수정 모달 데이터 바인딩 검증 유틸
// 수정 모드에서 행을 폼 상태에 매핑할 때, 핵심 필드가 누락(초기화)되지 않았는지 검증한다.

export type LoadedSaleLike = Record<string, unknown> & { id?: string };

/** 수정 폼이 의미를 가지려면 최소한 채워져 있어야 하는 필드 */
export const REQUIRED_LOAD_KEYS = [
  "id",
  "created_by",
  "channel",
  "manager",
  "customer_name",
  "open_date",
] as const;

/** 비어있다고 간주할지 판단 (null/undefined/빈문자열) */
export function isBlank(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

/** 원본 행에 비해 폼이 핵심 필드를 잃어버렸는지 검사 */
export function findMissingBoundKeys(
  original: LoadedSaleLike | null | undefined,
  bound: LoadedSaleLike | null | undefined,
  keys: readonly string[] = REQUIRED_LOAD_KEYS,
): string[] {
  if (!original || !bound) return [...keys];
  const missing: string[] = [];
  for (const k of keys) {
    if (!isBlank(original[k]) && isBlank(bound[k])) missing.push(k);
  }
  return missing;
}

/** 로드된 행 자체의 무결성 검사 — 필수 식별 필드가 살아있는지 */
export function verifyLoadedSale(row: LoadedSaleLike | null | undefined): {
  ok: boolean;
  missing: string[];
} {
  if (!row) return { ok: false, missing: ["row"] };
  const missing = (["id", "created_by"] as const).filter((k) => isBlank(row[k]));
  return { ok: missing.length === 0, missing };
}