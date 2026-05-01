/**
 * 직원 표시명 통합 포맷터.
 * - 퇴사/삭제 처리된 직원은 이름 뒤에 " (퇴사자)" 자동 부착
 * - 통계 합산은 기존 user_id 기반으로 이뤄지므로 표시 단계에서만 사용
 */
export type StaffStatus =
  | "active" | "pending" | "suspended" | "leave" | "resigned" | "deleted" | string | null | undefined;

export const RESIGNED_STATUSES: ReadonlyArray<string> = ["resigned", "deleted"];

export function isResignedStatus(status: StaffStatus): boolean {
  return !!status && RESIGNED_STATUSES.includes(status);
}

export function formatStaffName(
  name: string | null | undefined,
  statusOrResigned?: StaffStatus | boolean,
): string {
  const display = (name ?? "").trim() || "(이름없음)";
  const resigned =
    typeof statusOrResigned === "boolean"
      ? statusOrResigned
      : isResignedStatus(statusOrResigned);
  return resigned ? `${display}(퇴사자)` : display;
}

/** 단순 라벨용: 표시 문자열 그대로 반환 (배지 없이 인라인 텍스트 사용처) */
export function staffNameWithSuffix(
  name: string | null | undefined,
  resigned: boolean,
): string {
  return formatStaffName(name, resigned);
}