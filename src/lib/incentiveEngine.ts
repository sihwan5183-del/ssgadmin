// 인센티브 계산 엔진 v2
// 계단식 단가, 정액/정률, 그레이드 보너스, 인터넷 연동 지급률 지원

export interface TieredStep {
  min_qty: number;
  amount: number;
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
