// 인센티브 계산 엔진 v2
// 정책 기반 커스텀 빌더 + 계단식 단가 + 인터넷 연동 지급률 지원

export interface TieredStep {
  min_qty: number;
  amount: number;
}

/** 정책 기반 구간 (min_qty 이상 ~ max_qty 미만) */
export interface PolicyTier {
  min_qty: number;
  max_qty: number | null; // null = 이상(무제한)
  amount: number;
}

/** 인센티브 정책 (커스텀 빌더) */
export interface IncentivePolicy {
  id: string;
  name: string;
  target_sale_types: string[];
  target_products: string[];
  tiers: PolicyTier[];
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
  calc_method: "tiered" | "margin_100" | "fixed_amount";
  fixed_amount: number;
  match_model: string | null;
  bundle_only?: boolean;
  no_offer_only?: boolean;
}

export interface LinkageRule {
  enabled: boolean;
  /** 인터넷 건수별 모바일 지급률 배열 (오름차순). 예: [{min_qty:0,rate:0},{min_qty:1,rate:50},{min_qty:2,rate:100}] */
  tiers: { min_qty: number; rate: number }[];
  /** 예외 그레이드 목록 — 이 직급은 항상 100% 지급 */
  exempt_grades: string[];
}

export const DEFAULT_LINKAGE: LinkageRule = {
  enabled: true,
  tiers: [
    { min_qty: 0, rate: 0 },
    { min_qty: 1, rate: 50 },
    { min_qty: 2, rate: 100 },
  ],
  exempt_grades: [],
};

/**
 * 정책 기반 인센티브 계산 (커스텀 빌더)
 * - 각 정책의 target_sale_types/target_products에 매칭되는 실적만 합산
 * - 합산 건수를 기준으로 해당 정책의 구간 단가 결정
 * - 매칭되는 모든 건에 해당 단가를 적용
 */
export interface PolicyCalcResult {
  policyId: string;
  policyName: string;
  matchedCount: number;
  tierAmount: number;
  subtotal: number;
  calcMethod: "tiered" | "margin_100" | "fixed_amount";
  /** Per-sale breakdown for detailed view */
  saleDetails?: { saleId: string; amount: number; label: string }[];
}

function policyMatchesSale(policy: IncentivePolicy, sale: SaleForIncentive): boolean {
  if (!policy.active) return false;
  if (!inDateRange(sale.open_date, policy.valid_from, policy.valid_to)) return false;
  const stMatch = policy.target_sale_types.length === 0 || policy.target_sale_types.includes(sale.sale_type ?? "");
  const pMatch = policy.target_products.length === 0 || policy.target_products.includes(sale.product ?? "");
  const mMatch = !policy.match_model || policy.match_model === (sale.device_model ?? "");
  if (!stMatch || !pMatch || !mMatch) return false;
  if (policy.bundle_only && !(sale.bundle && sale.bundle.length > 0)) return false;
  if (policy.no_offer_only && sale.has_offer !== false) return false;
  return true;
}

function resolvePolicyTierAmount(tiers: PolicyTier[], qty: number): number {
  // Sort descending by min_qty
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
  for (const t of sorted) {
    if (qty >= t.min_qty) {
      if (t.max_qty === null || qty < t.max_qty) return Number(t.amount);
      // qty >= max_qty → continue to check higher tier
    }
  }
  // Fallback: find the tier where qty falls within range
  for (const t of tiers) {
    if (qty >= t.min_qty && (t.max_qty === null || qty < t.max_qty)) {
      return Number(t.amount);
    }
  }
  return 0;
}

export function calcPolicyIncentives(
  sales: SaleForIncentive[],
  policies: IncentivePolicy[],
): PolicyCalcResult[] {
  const results: PolicyCalcResult[] = [];
  for (const p of policies) {
    if (!p.active) continue;
    const matched = sales.filter((s) => policyMatchesSale(p, s));
    const count = matched.length;
    const method = p.calc_method ?? "tiered";

    if (method === "margin_100") {
      // 순마진 100% — 각 건의 net_fee 합산
      let subtotal = 0;
      const saleDetails = matched.map((s) => {
        const amt = Number(s.net_fee ?? 0);
        subtotal += amt;
        return { saleId: s.id, amount: amt, label: "순마진100%" };
      });
      results.push({ policyId: p.id, policyName: p.name, matchedCount: count, tierAmount: 0, subtotal, calcMethod: method, saleDetails });
    } else if (method === "fixed_amount") {
      // 고정 금액 지급
      const perSale = Number(p.fixed_amount ?? 0);
      const saleDetails = matched.map((s) => ({ saleId: s.id, amount: perSale, label: `고정 ${perSale.toLocaleString()}원` }));
      results.push({ policyId: p.id, policyName: p.name, matchedCount: count, tierAmount: perSale, subtotal: perSale * count, calcMethod: method, saleDetails });
    } else {
      // 구간제 (tiered)
      const tierAmount = resolvePolicyTierAmount(p.tiers, count);
      const saleDetails = matched.map((s) => ({ saleId: s.id, amount: tierAmount, label: `구간 ${tierAmount.toLocaleString()}원` }));
      results.push({ policyId: p.id, policyName: p.name, matchedCount: count, tierAmount, subtotal: tierAmount * count, calcMethod: method, saleDetails });
    }
  }
  return results;
}

/**
 * 정책 + 연동 지급률 통합 계산
 */
export function calcFullIncentive(
  sales: SaleForIncentive[],
  policies: IncentivePolicy[],
  linkage: LinkageRule | null,
  internetCount: number,
  grade?: string | null,
) {
  const policyResults = calcPolicyIncentives(sales, policies);
  let rawTotal = policyResults.reduce((s, r) => s + r.subtotal, 0);

  // 인터넷 연동 비율은 모바일 계열 정책에만 적용
  const linkageRate = linkage ? calcLinkageRate(linkage, internetCount, grade) : 100;
  // 모바일 계열 판정: target_products/target_sale_types에 모바일 관련 항목 포함
  const MOBILE_KEYWORDS = ["모바일", "MNP", "USIM"];
  let mobileSubtotal = 0;
  let otherSubtotal = 0;
  for (const r of policyResults) {
    const policy = policies.find((p) => p.id === r.policyId);
    const isMobile = policy && (
      policy.target_sale_types.some((t) => MOBILE_KEYWORDS.some((k) => t.includes(k))) ||
      policy.target_products.some((p) => MOBILE_KEYWORDS.some((k) => p.includes(k)))
    );
    if (isMobile) mobileSubtotal += r.subtotal;
    else otherSubtotal += r.subtotal;
  }

  const adjustedMobile = Math.round(mobileSubtotal * linkageRate / 100);
  const total = adjustedMobile + otherSubtotal;

  return {
    policyResults,
    rawTotal,
    mobileSubtotal,
    adjustedMobile,
    otherSubtotal,
    linkageRate,
    total,
  };
}

export interface IncentiveRate {
  id: string;
  label: string;
  scope: string;
  match_sale_type: string | null;
  match_product: string | null;
  match_model: string | null;
  amount: number;
  priority: number;
  active: boolean;
  valid_from: string | null;
  valid_to: string | null;
  note: string | null;
  pay_type: "fixed" | "percent";
  pay_percent: number;
  tiered_rates: TieredStep[];
  grade_bonus: Record<string, number>;
}

export interface SaleForIncentive {
  id: string;
  open_date: string | null;
  device_model: string | null;
  product: string | null;
  sale_type: string | null;
  customer_name?: string | null;
  net_fee?: number | null;
  bundle?: string | null;
  has_offer?: boolean;
}

export interface IncentiveBreakdown {
  saleId: string;
  amount: number;
  matched: { rateId: string; label: string; amount: number }[];
}

const inDateRange = (date: string | null, from: string | null, to: string | null) => {
  if (!from && !to) return true;
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
};

const matches = (rule: IncentiveRate, sale: SaleForIncentive) => {
  if (!rule.active) return false;
  if (!inDateRange(sale.open_date, rule.valid_from, rule.valid_to)) return false;
  if (rule.match_sale_type && rule.match_sale_type !== (sale.sale_type ?? "")) return false;
  if (rule.match_product && rule.match_product !== (sale.product ?? "")) return false;
  if (rule.match_model && rule.match_model !== (sale.device_model ?? "")) return false;
  return true;
};

/**
 * 계단식 단가 적용: 해당 규칙에 매칭되는 총 건수(totalQty)를 기준으로
 * 가장 높은 구간의 단가를 반환. 구간이 없으면 기본 amount 사용.
 */
function resolveTieredAmount(rate: IncentiveRate, totalQty: number): number {
  const tiers = rate.tiered_rates;
  if (!tiers || tiers.length === 0) return Number(rate.amount || 0);

  // 내림차순 정렬 후 첫 번째 매칭
  const sorted = [...tiers].sort((a, b) => b.min_qty - a.min_qty);
  for (const t of sorted) {
    if (totalQty >= t.min_qty) return Number(t.amount);
  }
  return Number(rate.amount || 0); // 최저 구간 미달 시 기본 단가
}

/**
 * 단건 단가 계산 (정액 vs 정률)
 */
function resolvePerSaleAmount(rate: IncentiveRate, sale: SaleForIncentive, totalQty: number): number {
  if (rate.pay_type === "percent") {
    const base = Number(sale.net_fee || 0);
    return Math.round(base * (Number(rate.pay_percent || 0) / 100));
  }
  // 계단식 적용
  return resolveTieredAmount(rate, totalQty);
}

/**
 * 전체 sales에서 각 규칙별 매칭 건수를 미리 집계 (계단식 단가용)
 */
function buildQtyMap(sales: SaleForIncentive[], rates: IncentiveRate[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of rates) {
    let count = 0;
    for (const s of sales) {
      if (matches(r, s)) count++;
    }
    map.set(r.id, count);
  }
  return map;
}

/**
 * 단건 인센티브 계산
 */
export function calcIncentiveForSale(
  sale: SaleForIncentive,
  rates: IncentiveRate[],
  qtyMap?: Map<string, number>,
): IncentiveBreakdown {
  const matched = rates.filter((r) => matches(r, sale));
  let amount = 0;
  const details: IncentiveBreakdown["matched"] = [];

  for (const r of matched) {
    const qty = qtyMap?.get(r.id) ?? 1;
    const perSale = resolvePerSaleAmount(r, sale, qty);
    amount += perSale;
    details.push({ rateId: r.id, label: r.label, amount: perSale });
  }

  return { saleId: sale.id, amount, matched: details };
}

/**
 * 그레이드 보너스 계산: 해당 직급/등급에 맞는 추가 보너스 합산
 */
export function calcGradeBonus(rates: IncentiveRate[], grade?: string | null): number {
  if (!grade) return 0;
  let bonus = 0;
  for (const r of rates) {
    if (!r.active) continue;
    const gb = r.grade_bonus;
    if (gb && typeof gb === "object" && grade in gb) {
      bonus += Number(gb[grade] || 0);
    }
  }
  return bonus;
}

/**
 * 인터넷 연동 지급률 계산
 */
export function calcLinkageRate(linkage: LinkageRule, internetCount: number, grade?: string | null): number {
  if (!linkage.enabled) return 100;
  if (grade && linkage.exempt_grades.includes(grade)) return 100;
  const sorted = [...linkage.tiers].sort((a, b) => b.min_qty - a.min_qty);
  for (const t of sorted) {
    if (internetCount >= t.min_qty) return t.rate;
  }
  return 0;
}

/**
 * 전체 인센티브 집계 (계단식 + 정률 + 그레이드 보너스)
 */
export function calcTotalIncentive(
  sales: SaleForIncentive[],
  rates: IncentiveRate[],
  grade?: string | null,
  linkage?: LinkageRule | null,
  internetCount?: number,
) {
  const qtyMap = buildQtyMap(sales, rates);
  let total = 0;
  let mobileTotal = 0;
  let nonMobileTotal = 0;
  const breakdowns: IncentiveBreakdown[] = [];
  for (const s of sales) {
    const b = calcIncentiveForSale(s, rates, qtyMap);
    // 모바일 계열 판별 (product가 '모바일' 또는 sale_type 기반)
    const isMobile = (s.product ?? "").includes("모바일") || (s.sale_type ?? "") === "번호이동" || (s.sale_type ?? "") === "기기변경" || (s.sale_type ?? "") === "신규가입";
    if (isMobile) {
      mobileTotal += b.amount;
    } else {
      nonMobileTotal += b.amount;
    }
    breakdowns.push(b);
  }

  // 인터넷 연동 지급률 적용
  const linkageRate = linkage ? calcLinkageRate(linkage, internetCount ?? 0, grade) : 100;
  const adjustedMobile = Math.round(mobileTotal * linkageRate / 100);
  total = adjustedMobile + nonMobileTotal;

  const gradeBonus = calcGradeBonus(rates, grade);
  total += gradeBonus;

  return {
    total,
    breakdowns,
    gradeBonus,
    mobileTotal,
    adjustedMobile,
    nonMobileTotal,
    linkageRate,
  };
}

/**
 * Linear forecast
 */
export function forecastIncentive(currentTotal: number, periodStart: string, periodEnd: string, today = new Date()) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const ms = 1000 * 60 * 60 * 24;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / ms) + 1);
  const elapsedDays = Math.min(totalDays, Math.max(1, Math.round((today.getTime() - start.getTime()) / ms) + 1));
  const dailyAvg = currentTotal / elapsedDays;
  const projected = Math.round(dailyAvg * totalDays);
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  return { projected, dailyAvg, elapsedDays, totalDays, remainingDays };
}
