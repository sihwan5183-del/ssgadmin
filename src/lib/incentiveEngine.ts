// 인센티브 계산 엔진
// 각 sale 레코드에 대해 incentive_rates 마스터를 매칭하여 단가를 부여한다.

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
}

export interface SaleForIncentive {
  id: string;
  open_date: string | null;
  device_model: string | null;
  product: string | null;
  sale_type: string | null;
  customer_name?: string | null;
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
  // at least one criterion must be specified, otherwise it's an "all-match" base
  return true;
};

/**
 * Sums all matching rates for each sale (rates are additive, e.g. base + promotion bonus).
 */
export function calcIncentiveForSale(sale: SaleForIncentive, rates: IncentiveRate[]): IncentiveBreakdown {
  const matched = rates.filter((r) => matches(r, sale));
  const amount = matched.reduce((s, r) => s + Number(r.amount || 0), 0);
  return {
    saleId: sale.id,
    amount,
    matched: matched.map((r) => ({ rateId: r.id, label: r.label, amount: Number(r.amount || 0) })),
  };
}

export function calcTotalIncentive(sales: SaleForIncentive[], rates: IncentiveRate[]) {
  let total = 0;
  const breakdowns: IncentiveBreakdown[] = [];
  for (const s of sales) {
    const b = calcIncentiveForSale(s, rates);
    total += b.amount;
    breakdowns.push(b);
  }
  return { total, breakdowns };
}

/**
 * Linear forecast based on elapsed days within the current period.
 * Returns projected month-end incentive given current pace.
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
