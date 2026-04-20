// 실적 카테고리 분류 — 모바일 / 홈 / 업셀
// 기존 sales.product 값을 기반으로 3가지 메타 카테고리로 매핑

export type SalesCategory = "mobile" | "home" | "upsell";

export interface CategoryMeta {
  key: SalesCategory;
  label: string;
  color: string; // hsl
  weight: number; // 통합 성과 점수
}

// ⚠️ 가중치는 useCategoryWeights() 훅에서 app_settings 값으로 덮어써짐 (관리자 조정 가능)
export const DEFAULT_CATEGORY_META: Record<SalesCategory, CategoryMeta> = {
  mobile: { key: "mobile", label: "모바일", color: "hsl(195 90% 60%)", weight: 1.0 },
  home: { key: "home", label: "홈", color: "hsl(280 90% 65%)", weight: 2.0 },
  upsell: { key: "upsell", label: "업셀", color: "hsl(38 95% 60%)", weight: 0.5 },
};

const MOBILE_PRODUCTS = new Set(["모바일", "USIM MNP", "세컨"]);
const HOME_PRODUCTS = new Set(["인터넷", "TV프리", "홈"]);
const UPSELL_PRODUCTS = new Set(["IOT", "대명", "VAS", "부가서비스"]);

export function classifySale(row: { product?: string | null; vas1?: string | null; vas2?: string | null }): SalesCategory {
  const p = (row.product || "").trim();
  if (HOME_PRODUCTS.has(p)) return "home";
  if (UPSELL_PRODUCTS.has(p)) return "upsell";
  if (MOBILE_PRODUCTS.has(p)) return "mobile";
  // product 비어있으면: VAS만 잡혀있는 행은 업셀로
  if (!p && (row.vas1 || row.vas2)) return "upsell";
  return "mobile"; // 기본값
}

/** 순수 수익 (net_fee − 출고/현금지원/추가지원) */
export function pureProfit(row: any): number {
  return (
    (Number(row.net_fee) || 0) -
    (Number(row.distributor_amount) || 0) -
    (Number(row.cash_support_amount) || 0) -
    (Number(row.extra_subsidy) || 0)
  );
}

/** 업셀 행의 부가 수익 = vas_fee + net_fee */
export function upsellExtraRevenue(row: any): number {
  return (Number(row.vas_fee) || 0) + (Number(row.net_fee) || 0);
}
