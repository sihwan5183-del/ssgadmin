export type ProfitSource = Record<string, any>;

// 모요 수수료 건당 단가 (총량 정산 집계용)
export const MOYO_FEE_PER_ACTIVATION = 88_000;

const toNumber = (value: unknown): number => {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized);
  if (Number.isFinite(parsed)) return parsed;
  const digits = normalized.match(/-?\d+(?:\.\d+)?/g)?.join("") ?? "";
  return digits ? Number(digits) || 0 : 0;
};

export const pickAmount = (row: ProfitSource, ...keys: string[]): number => {
  for (const key of keys) {
    const direct = toNumber(row?.[key]);
    if (direct !== 0) return direct;
    const custom = toNumber(row?.custom_fields?.[key]);
    if (custom !== 0) return custom;
  }
  return 0;
};

/**
 * 단건 모요 수수료 판정 (모요 채널 + 모바일 상품 + 미제외)
 * ⚠️ 건별 차감용이 아니라 "이 건이 모요 과금 대상인가" 판정 전용.
 * 실제 비용 차감은 월 총 판매건수 기준 총량 정산으로 처리할 것.
 */
export const isMoyoBillable = (row: ProfitSource): boolean => {
  const channel = String(row?.channel ?? "").trim().toLowerCase();
  const excluded = row?.moyo_excluded === true;
  const product = String(row?.product ?? "").trim().toLowerCase();
  const isMobile = product === "모바일" || product === "mobile";
  const isMoyoChannel = channel === "모요" || channel.includes("moyo");
  return !excluded && isMoyoChannel && isMobile;
};

/**
 * 모요 총량 정산 계산
 * - rows: 해당 기간 전체 실적
 * - feePerActivation: 건당 수수료 (기본 88,000원, 향후 구간제 가능)
 * - 반환: { count, totalFee }
 *
 * 사용처: SalesLedgerPage loadSummary, ProfitPage 수익 요약
 * ※ calcDashboardProfit에서는 moyoFee를 항상 0으로 반환하도록 변경됨
 */
export const calcMonthlyMoyoFee = (
  rows: ProfitSource[],
  feePerActivation = MOYO_FEE_PER_ACTIVATION,
): { count: number; totalFee: number } => {
  const count = rows.filter(isMoyoBillable).length;
  return { count, totalFee: count * feePerActivation };
};

/** @deprecated 건별 차감용으로 쓰지 말 것. isMoyoBillable + calcMonthlyMoyoFee 사용 */
export const calcMoyoFee = (_row: ProfitSource): number => 0;

const isSettled = (value: unknown, positiveValues: string[]) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return positiveValues.some((v) => normalized === v.toLowerCase());
};

/**
 * 건별 수익/지출 계산 (단일 공식 — SalesLedger, 대시보드, ProfitPage 통일)
 *
 * [수익] = 단가표(unit_price) + 부가서비스(vas_fee)
 *         + 미수금(receivable_amount, receivable_paid=완료 일 때만)
 *         + 상품권(voucher, voucher_returned=유 일 때만)
 *         + 중고폰(trade_in_confirmed, trade_in_enabled=false 제외)
 *
 * [지출] = 유통망(distributor_amount)
 *         + 현금개통(cash_support_amount, cash_open=true 일 때만)
 *         + 추가지원금(extra_subsidy)
 *         + 고객지원금(customer_support_amount)
 *         + 법인카드(corp_card_amount)
 *
 * ⚠️ 모요 수수료는 건별 차감 안 함 (moyoFee 항상 0)
 *    → 월 집계 시 calcMonthlyMoyoFee()로 별도 합산 후 최종 차감
 *
 * ※ 광고비는 sale 단위 아닌 ad_spend 별도 집계.
 */
export const calcDashboardProfit = (row: ProfitSource) => {
  // 수익
  const salesCommission = pickAmount(row, "unit_price", "sales_commission", "commission");
  const vasFee = pickAmount(row, "vas_fee");
  const receivablePaid = isSettled(row?.receivable_paid, ["완료", "수급완료", "입금완료", "유", "yes", "true"]);
  const receivableAmount = receivablePaid ? pickAmount(row, "receivable_amount") : 0;
  const voucherReturned = isSettled(row?.voucher_returned, ["유", "완료", "반납완료", "yes", "true"]);
  const voucherAmount = voucherReturned
    ? pickAmount(row, "voucher_amount", "gift_certificate_amount", "voucher")
    : 0;
  const tradeInConfirmed = row?.trade_in_enabled === false ? 0 : pickAmount(row, "trade_in_confirmed");

  // 지출 (모요 수수료 제외)
  const distributor = pickAmount(row, "distributor_amount");
  const cashOpen = row?.cash_open === true;
  const cashSupport = cashOpen ? pickAmount(row, "cash_support_amount") : 0;
  const offerSubsidy = pickAmount(row, "extra_subsidy", "offer_subsidy");
  const customerSupport = pickAmount(row, "customer_support_amount");
  const cardSubsidy = pickAmount(row, "corp_card_amount", "corp_card_payment_amount", "corporate_card_amount");
  const moyoFee = 0; // 총량 정산 → 건별 차감 없음

  const revenue =
    salesCommission + vasFee + receivableAmount + voucherAmount + tradeInConfirmed;
  const expense =
    distributor + cashSupport + offerSubsidy + customerSupport + cardSubsidy;

  return {
    salesCommission,
    vasFee,
    receivableAmount,
    voucherAmount,
    tradeInConfirmed,
    distributor,
    cashSupport,
    offerSubsidy,
    customerSupport,
    cardSubsidy,
    moyoFee,        // 항상 0 (하위 호환용으로 반환은 유지)
    revenue,
    expense,
    profit: revenue - expense,
  };
};
