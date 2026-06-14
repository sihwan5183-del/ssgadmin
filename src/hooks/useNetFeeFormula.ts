import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { evaluateFormula } from "@/lib/formulaEngine";

// 최종 순수익 = 5대 수익 - 5대 오퍼
// 수익(Plus): 중고폰(trade_in_confirmed) + 단가표(unit_price) + 부가서비스(vas_fee) + 미수금(receivable_amount) + 상품권(voucher_amount)
// 오퍼(Minus): 유통망(distributor_amount) + 현금개통(cash_support_amount) + 추가지원금(extra_subsidy) + 고객지원금(customer_support_amount) + 법인카드(corp_card_amount) + 제휴카드 할인(partner_card_discount)
const DEFAULT_FORMULA =
  "trade_in_confirmed + unit_price + vas_fee + receivable_amount + voucher_amount - distributor_amount - cash_support_amount - extra_subsidy - customer_support_amount - corp_card_amount - partner_card_discount";
const DEFAULT_VARS = [
  "trade_in_confirmed",
  "unit_price",
  "vas_fee",
  "receivable_amount",
  "voucher_amount",
  "distributor_amount",
  "cash_support_amount",
  "extra_subsidy",
  "customer_support_amount",
  "corp_card_amount",
  "partner_card_discount",
];

/** 5대 수익 키 */
export const REVENUE_KEYS = [
  "trade_in_confirmed",
  "unit_price",
  "vas_fee",
  "receivable_amount",
  "voucher_amount",
] as const;

/** 5대 오퍼/지출 키 (+ 제휴카드 할인) */
export const OFFER_KEYS = [
  "distributor_amount",
  "cash_support_amount",
  "extra_subsidy",
  "customer_support_amount",
  "corp_card_amount",
  "partner_card_discount",
] as const;

/** custom_fields 까지 살펴서 숫자값을 안전하게 추출 */
const pickNum = (row: Record<string, any>, key: string): number => {
  const direct = row?.[key];
  if (direct != null && !Number.isNaN(Number(direct))) return Number(direct) || 0;
  const cf = row?.custom_fields;
  if (cf && cf[key] != null && !Number.isNaN(Number(cf[key]))) return Number(cf[key]) || 0;
  return 0;
};

/** 총 수익 합계 (5대 수익 항목) */
export const sumRevenue = (row: Record<string, any>): number => {
  // 중고폰은 trade_in_enabled=true 일 때만 가산
  const tradeIn = row?.trade_in_enabled === false ? 0 : pickNum(row, "trade_in_confirmed");
  // 상품권은 반납 완료된 경우에만 수익 인식
  const voucherReturned = ["유", "완료", "반납완료", "yes", "true"].includes(
    String(row?.voucher_returned ?? "").trim().toLowerCase()
  );
  const voucherAmount = voucherReturned ? pickNum(row, "voucher_amount") : 0;
  return (
    tradeIn +
    pickNum(row, "unit_price") +
    pickNum(row, "vas_fee") +
    pickNum(row, "receivable_amount") +
    voucherAmount
  );
};

/** 총 오퍼/지출 합계 */
export const sumOffer = (row: Record<string, any>): number => {
  return OFFER_KEYS.reduce((s, k) => s + pickNum(row, k), 0);
};

/** 최종 순수익 = 수익 합계 - 오퍼 합계 */
export const calcNetProfit = (row: Record<string, any>): number => {
  return Math.round(sumRevenue(row) - sumOffer(row));
};

/**
 * 관리자 설정에서 net_fee 수식·변수 목록을 실시간으로 가져온다.
 * 반환된 calc(row)로 어디서든 동일한 식으로 net_fee 계산 가능.
 */
export const useNetFeeFormula = () => {
  const [formula, setFormula] = useState<string>(DEFAULT_FORMULA);
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["formula.net_fee", "formula.variables"]);
      if (cancelled) return;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => (map[r.key] = r.value));
      if (typeof map["formula.net_fee"] === "string") setFormula(map["formula.net_fee"]);
      if (Array.isArray(map["formula.variables"])) setVariables(map["formula.variables"]);
      setLoading(false);
    };
    load();
    const ch = supabase
      .channel(`formula-settings-${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  // 산식 고정: 5대 수익 - 5대 오퍼. 관리자가 app_settings 로 덮어쓰면 그쪽 우선.
  const calc = (row: Record<string, any>): number => {
    if (formula && formula !== DEFAULT_FORMULA) {
      const r = evaluateFormula(formula, row);
      if (r.ok) return Math.round(r.value!);
    }
    return calcNetProfit(row);
  };

  return { formula, variables, calc, loading };
};
