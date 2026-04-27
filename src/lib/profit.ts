export type ProfitSource = Record<string, any>;

const MOYO_FEE_PER_ACTIVATION = 88_000;

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

export const calcMoyoFee = (row: ProfitSource): number => {
  const channel = String(row?.channel ?? "").trim().toLowerCase();
  const excluded = row?.moyo_excluded === true;
  return !excluded && (channel === "모요" || channel.includes("moyo")) ? MOYO_FEE_PER_ACTIVATION : 0;
};

/**
 * 신규 정산 로직 (대표님 정의 기준)
 *
 * [수익] = 단가표 수수료(unit_price) + 부가서비스 수수료(vas_fee)
 *         + 미수금(receivable_amount, '수급완료' 상태만)
 *         + 상품권 금액(voucher, '반납완료' 상태만)
 *         + 중고폰(trade_in_confirmed, 확정 반납 금액)
 *
 * [지출] = 유통망지원금(distributor_amount)
 *         + 현금개통 금액(cash_support_amount, cash_open=true 일 때만 - 법인카드 토큰 ON 이중차감 방지)
 *         + 추가지원금(extra_subsidy)
 *         + 고객지원금(customer_support_amount)
 *         + 법인카드 결제금액(corp_card_amount)
 *         + 모요 수수료(88,000 / 모요 채널 & moyo_excluded=false 일 때)
 *
 * ※ 광고비/기타지출은 sale 단위가 아니라 ad_spend 합계로 별도 합산.
 */
export const calcDashboardProfit = (row: ProfitSource) => {
  // 수익
  const salesCommission = pickAmount(row, "unit_price", "sales_commission", "commission", "net_fee");
  const vasFee = pickAmount(row, "vas_fee");
  const receivablePaid = String(row?.receivable_paid ?? "").trim() === "유";
  const receivableAmount = receivablePaid ? pickAmount(row, "receivable_amount") : 0;
  const voucherReturned = String(row?.voucher_returned ?? "").trim() === "유";
  const voucherAmount = voucherReturned
    ? pickAmount(row, "voucher_amount", "gift_certificate_amount", "voucher")
    : 0;
  const tradeInConfirmed = pickAmount(row, "trade_in_confirmed");

  // 지출
  const distributor = pickAmount(row, "distributor_amount");
  const cashOpen = row?.cash_open === true;
  const cashSupport = cashOpen ? pickAmount(row, "cash_support_amount") : 0;
  const offerSubsidy = pickAmount(row, "extra_subsidy", "offer_subsidy");
  const customerSupport = pickAmount(row, "customer_support_amount");
  const cardSubsidy = pickAmount(row, "corp_card_amount", "card_amount", "card_payment_amount");
  const moyoFee = calcMoyoFee(row);

  const revenue =
    salesCommission + vasFee + receivableAmount + voucherAmount + tradeInConfirmed;
  const expense =
    distributor + cashSupport + offerSubsidy + customerSupport + cardSubsidy + moyoFee;

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
    moyoFee,
    revenue,
    expense,
    profit: revenue - expense,
  };
};