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

export const calcDashboardProfit = (row: ProfitSource) => {
  const salesCommission = pickAmount(row, "unit_price", "sales_commission", "commission", "net_fee");
  const voucherAmount = pickAmount(row, "voucher_amount", "gift_certificate_amount");
  const offerSubsidy = pickAmount(row, "extra_subsidy", "offer_subsidy");
  const cardSubsidy = pickAmount(row, "corp_card_amount", "card_amount", "card_payment_amount");
  const moyoFee = calcMoyoFee(row);
  const revenue = salesCommission + voucherAmount;
  const expense = offerSubsidy + cardSubsidy + moyoFee;

  return {
    salesCommission,
    voucherAmount,
    offerSubsidy,
    cardSubsidy,
    moyoFee,
    revenue,
    expense,
    profit: revenue - expense,
  };
};