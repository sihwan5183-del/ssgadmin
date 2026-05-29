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
  // 파스텔 전면 폐기 — 흰 배경 + 진한 텍스트/보더로 통일 (메타/도그마루/기타 동일 규격)
  상담전:    "bg-background text-red-700 border border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  미처리:    "bg-background text-red-700 border border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  상담중:    "bg-background text-blue-700 border border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  케어중:    "bg-background text-blue-700 border border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  부재:      "bg-background text-orange-700 border border-orange-600 font-bold dark:text-orange-300 dark:border-orange-400",
  재케어:    "bg-background text-violet-700 border border-violet-600 font-bold dark:text-violet-300 dark:border-violet-400",
  방문예약:  "bg-background text-indigo-700 border border-indigo-600 font-bold dark:text-indigo-300 dark:border-indigo-400",
  택배발송:  "bg-background text-indigo-700 border border-indigo-600 font-bold dark:text-indigo-300 dark:border-indigo-400",
  실패:      "bg-background text-rose-700 border border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400",
  개통완료:  "bg-background text-emerald-700 border border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
};

const FALLBACK_STYLE =
  "bg-background text-foreground border border-border font-semibold";

export const inquiryStatusClass = (status: string | null | undefined): string => {
  if (!status) return FALLBACK_STYLE;
  const key = STYLE_ALIASES[status] ?? status;
  return STYLES[key] ?? FALLBACK_STYLE;
};

// 부드러운 변형: 두꺼운 테두리 없이 은은한 배경 + 텍스트 컬러만 적용.
// Select 트리거/입력 폼에서 다른 페이지(실적입력, 단골관리)와 톤을 통일하기 위해 사용.
const SOFT_STYLES: Record<string, string> = {
  상담전: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300",
  상담중: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  부재: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  재케어: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  방문예약: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  택배발송: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  실패: "bg-red-50 text-red-700 dark:bg-destructive/10 dark:text-destructive",
  개통완료: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};

const SOFT_FALLBACK = "bg-muted/60 text-foreground/80";

export const inquiryStatusSoftClass = (status: string | null | undefined): string => {
  if (!status) return SOFT_FALLBACK;
  const key = STYLE_ALIASES[status] ?? status;
  return SOFT_STYLES[key] ?? SOFT_FALLBACK;
};

// 시인성 강화용 솔리드 배지: 진한 배경 + 흰색 글자.
// 리스트의 [최종상태] 컬럼처럼 한눈에 구분이 필요한 곳에서 사용.
const SOLID_STYLES: Record<string, string> = {
  // 솔리드 변형도 메타 탭과 동일하게 흰 배경 + 진한 텍스트/보더로 통일
  상담전:    "bg-background text-red-700 border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  미처리:    "bg-background text-red-700 border-red-600 font-bold dark:text-red-300 dark:border-red-400",
  상담중:    "bg-background text-blue-700 border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  케어중:    "bg-background text-blue-700 border-blue-600 font-bold dark:text-blue-300 dark:border-blue-400",
  부재:      "bg-background text-orange-700 border-orange-600 font-bold dark:text-orange-300 dark:border-orange-400",
  재케어:    "bg-background text-violet-700 border-violet-600 font-bold dark:text-violet-300 dark:border-violet-400",
  방문예약:  "bg-background text-indigo-700 border-indigo-600 font-bold dark:text-indigo-300 dark:border-indigo-400",
  택배발송:  "bg-background text-indigo-700 border-indigo-600 font-bold dark:text-indigo-300 dark:border-indigo-400",
  실패:      "bg-background text-rose-700 border-rose-600 font-bold dark:text-rose-300 dark:border-rose-400",
  개통완료:  "bg-background text-emerald-700 border-emerald-600 font-bold dark:text-emerald-300 dark:border-emerald-400",
};

const SOLID_FALLBACK = "bg-background text-foreground border-border font-semibold";

export const inquiryStatusSolidClass = (status: string | null | undefined): string => {
  if (!status) return SOLID_FALLBACK;
  const key = STYLE_ALIASES[status] ?? status;
  return SOLID_STYLES[key] ?? SOLID_FALLBACK;
};

// 텍스트 전용 변형: 테두리/배경 없이 진한 텍스트 컬러만 적용.
// 리스트의 [최종상태] 컬럼에서 알약/뱃지 껍데기를 걷어내고 글자색만으로 상태를 구분할 때 사용.
const TEXT_STYLES: Record<string, string> = {
  상담전:    "text-red-700 dark:text-red-300",
  미처리:    "text-red-700 dark:text-red-300",
  상담중:    "text-blue-700 dark:text-blue-300",
  케어중:    "text-blue-700 dark:text-blue-300",
  부재:      "text-orange-700 dark:text-orange-300",
  재케어:    "text-violet-700 dark:text-violet-300",
  방문예약:  "text-indigo-700 dark:text-indigo-300",
  택배발송:  "text-indigo-700 dark:text-indigo-300",
  택배개통:  "text-indigo-700 dark:text-indigo-300",
  실패:      "text-rose-700 dark:text-rose-300",
  취소:      "text-rose-700 dark:text-rose-300",
  개통완료:  "text-emerald-700 dark:text-emerald-300",
};

const TEXT_FALLBACK = "text-foreground";

export const inquiryStatusTextClass = (status: string | null | undefined): string => {
  if (!status) return TEXT_FALLBACK;
  const key = STYLE_ALIASES[status] ?? status;
  return TEXT_STYLES[key] ?? TEXT_FALLBACK;
};