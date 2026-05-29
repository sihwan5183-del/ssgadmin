/**
 * 채널(유입경로) 정규화 헬퍼.
 *
 * 전산의 모든 대시보드/장표에서 채널을 다음 5개 핵심 카테고리로만 병합한다.
 *   - 모요
 *   - 모두의 성지
 *   - 유닥        ← '오프라인', '유닥', '유닥(UDAK)' 등 통합
 *   - 도그마루
 *   - SEG활동     ← 'SEG'가 포함된 모든 항목 통합
 *
 * 위 5개에 해당하지 않는 값은 null 을 반환한다. (대시보드/장표에서 필터링 처리)
 */
export const CHANNEL_GROUPS = [
  "모요",
  "모두의 성지",
  "유닥",
  "도그마루",
  "SEG활동",
] as const;

export type ChannelGroup = (typeof CHANNEL_GROUPS)[number];

export function groupChannel(raw: string | null | undefined): ChannelGroup | null {
  const v = (raw ?? "").toString().trim();
  if (!v) return null;
  const lower = v.toLowerCase();

  // SEG 포함 → SEG활동
  if (lower.includes("seg")) return "SEG활동";

  // 모요
  if (v.includes("모요")) return "모요";

  // 모두의 성지
  if (v.includes("모두의 성지") || v.replace(/\s+/g, "").includes("모두의성지")) {
    return "모두의 성지";
  }

  // 도그마루
  if (v.includes("도그마루")) return "도그마루";

  // 유닥 통합 (오프라인 / 유닥 / 유닥(UDAK) 등)
  if (
    v.includes("유닥") ||
    lower.includes("udak") ||
    v === "오프라인" ||
    v.includes("오프라인")
  ) {
    return "유닥";
  }

  return null;
}

export const isAllowedChannel = (raw: string | null | undefined): boolean =>
  groupChannel(raw) !== null;