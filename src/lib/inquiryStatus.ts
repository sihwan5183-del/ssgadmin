// 인입 상태별 시각 스타일을 한 곳에서 관리하여 등록창/변경창/리스트의 색상 규격을 통일.
// 관리자가 새로 추가한 상태는 자동으로 기본 회색 스타일을 사용합니다.

export const INQUIRY_DEFAULT_STATUS = "상담전";

// 동의어 매핑 (예: "미처리" → "상담전" 컬러 사용)
const STYLE_ALIASES: Record<string, string> = {
  미처리: "상담전",
  상담전: "상담전",
  상담중: "상담중",
  문의중: "상담중",
  부재: "부재",
  재통화: "재케어",
  재케어: "재케어",
  예약: "방문예약",
  방문예약: "방문예약",
  택배발송: "택배발송",
  실패: "실패",
  종료: "실패",
  개통완료: "개통완료",
};

const STYLES: Record<string, string> = {
  상담전:
    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-600",
  상담중:
    "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30",
  부재:
    "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
  재케어:
    "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  방문예약:
    "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-500/20 dark:text-violet-300 dark:border-violet-500/30",
  택배발송:
    "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30",
  실패:
    "bg-red-100 text-red-700 border-red-300 dark:bg-destructive/20 dark:text-destructive dark:border-destructive/30",
  개통완료:
    "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
};

const FALLBACK_STYLE =
  "bg-muted text-muted-foreground border-border/60";

export const inquiryStatusClass = (status: string | null | undefined): string => {
  if (!status) return FALLBACK_STYLE;
  const key = STYLE_ALIASES[status] ?? status;
  return STYLES[key] ?? FALLBACK_STYLE;
};