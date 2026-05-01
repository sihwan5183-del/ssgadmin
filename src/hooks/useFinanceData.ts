import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useBudgetCategories, type BudgetCategory } from "./useBudgetCategories";
import { calcDashboardProfit } from "@/lib/profit";

/**
 * 지출/ROI 화면 전용 통합 집계 훅
 * - 모든 수치는 선택된 기간(start~end)에서 sales / ad_spend 실데이터로 계산
 * - mock 의존 없음
 */
export interface FinanceChannelRow {
  channel: string;
  spend: number;        // ad_spend.amount 합 (해당 채널)
  successCount: number; // sales 건수 (해당 채널)
  rebate: number;       // sales.unit_price 합 (마진/수익 대용)
  offer: number;        // sales.cash_support_amount + extra_subsidy 합
  avgOffer: number;     // offer / successCount
  cpa: number;          // spend / successCount
  cost: number;         // spend + offer
  margin: number;       // rebate - cost
  marginRate: number;   // margin / rebate * 100
}

export interface FinanceMediaTotal {
  media: string;
  total: number;
}

export interface FinanceDailyPoint {
  date: string;
  day: string;
  total: number;
  [media: string]: number | string;
}

export interface FinanceProductRow {
  item: string;
  amount: number;
  color: string;
}

export interface FinanceWeeklyOffer {
  week: string;
  [channel: string]: number | string;
}

export interface FinanceData {
  loading: boolean;
  // 핵심 합계
  totalRevenue: number;         // sales.unit_price 합 (= 총 마진/수익)
  totalAdSpend: number;         // ad_spend.amount 합
  totalDistributor: number;     // sales.distributor_amount 합
  totalCustomerDeposit: number; // sales.receivable_amount 합
  totalCashOpen: number;        // sales.cash_support_amount 합
  totalOffer: number;           // sales.cash_support_amount + extra_subsidy 합
  totalSuccess: number;         // sales 건수 (open_date in range)
  totalExpense: number;         // ad + 유통망 + 고객입금
  netMargin: number;            // totalRevenue - totalExpense
  roi: number;                  // netMargin / totalExpense * 100
  cpaAvg: number;               // totalAdSpend / totalSuccess
  marginRate: number;           // netMargin / totalRevenue * 100
  // 직전 동일 길이 구간 (증감 비교용)
  prev: {
    totalRevenue: number;
    totalExpense: number;
    netMargin: number;
    roi: number;
    totalSuccess: number;
    cpaAvg: number;
  };
  // 신규 정밀 합산 (대표님 정의 기준)
  revenueBreakdown: { label: string; amount: number; key: string }[];
  expenseBreakdown: { label: string; amount: number; key: string }[];
  // 모요
  moyoAppliedCount: number;     // 모요 적용 건수
  moyoExcludedCount: number;    // 모요 미적용 건수
  moyoFee: number;              // 모요 수수료 (적용건 × 88,000)
  excludedLabels: string[];     // 대시보드에서 제외된 항목들
  // 항목별 세부 금액
  categoryBreakdown: { label: string; type: string; amount: number; included: boolean }[];
  // 차트용
  channels: FinanceChannelRow[];
  mediaTotals: FinanceMediaTotal[];
  daily: FinanceDailyPoint[];
  mediaList: string[];
  products: FinanceProductRow[];
  offerWeekly: FinanceWeeklyOffer[];
  channelNames: string[];
  // 데이터 검증
  hasSales: boolean;
  hasSpend: boolean;
}

const PRODUCT_PALETTE: Record<string, string> = {
  모바일: "hsl(152 76% 50%)",
  "USIM MNP": "hsl(168 75% 55%)",
  세컨: "hsl(195 75% 55%)",
  인터넷: "hsl(180 70% 55%)",
  TV프리: "hsl(200 70% 55%)",
  홈: "hsl(210 70% 55%)",
  대명: "hsl(45 80% 55%)",
  스마트홈: "hsl(280 70% 60%)",
  기타: "hsl(220 10% 60%)",
};

const pad = (n: number) => String(n).padStart(2, "0");

const isoWeekKey = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(
    ((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7,
  );
  return `${pad(d.getMonth() + 1)}/W${week % 5 || 1}`;
};

export function useFinanceData(): FinanceData {
  const { startDate, endDate, prevStartDate, prevEndDate } = usePeriod();
  const { categories, includedExpenseLabels, excludedLabels } = useBudgetCategories();
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [spendRows, setSpendRows] = useState<any[]>([]);
  const [prevSalesRows, setPrevSalesRows] = useState<any[]>([]);
  const [prevSpendRows, setPrevSpendRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [salesRes, spendRes, prevSalesRes, prevSpendRes] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "created_by, manager, channel, product, open_date, unit_price, distributor_amount, cash_support_amount, cash_open, extra_subsidy, customer_support_amount, corp_card_amount, receivable_amount, receivable_paid, moyo_excluded, vas_fee, net_fee, voucher, voucher_returned, trade_in_enabled, trade_in_confirmed, custom_fields",
          )
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .in("status", ["개통완료", "설치완료"])
          .limit(10000),
        supabase
          .from("ad_spend")
          .select("media, channel, category, amount, spend_date")
          .gte("spend_date", startDate)
          .lte("spend_date", endDate)
          .limit(10000),
        supabase
          .from("sales")
          .select(
            "channel, product, open_date, unit_price, distributor_amount, cash_support_amount, extra_subsidy, customer_support_amount, corp_card_amount, receivable_amount, vas_fee, net_fee, voucher, voucher_returned, trade_in_enabled, trade_in_confirmed, moyo_excluded, custom_fields",
          )
          .gte("open_date", prevStartDate)
          .lte("open_date", prevEndDate)
          .in("status", ["개통완료", "설치완료"])
          .limit(10000),
        supabase
          .from("ad_spend")
          .select("category, amount, spend_date")
          .gte("spend_date", prevStartDate)
          .lte("spend_date", prevEndDate)
          .limit(10000),
      ]);
      if (cancelled) return;
      setSalesRows(salesRes.data ?? []);
      setSpendRows(spendRes.data ?? []);
      setPrevSalesRows(prevSalesRes.data ?? []);
      setPrevSpendRows(prevSpendRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate, prevStartDate, prevEndDate]);

  return useMemo<FinanceData>(() => {
    // ※ 모든 행은 status=개통완료 (쿼리에서 필터됨).
    //    상품권/미수금/중고폰은 '확정 상태'에서만 수익으로 잡히므로 정산 제외 필터 불필요.
    const settledSalesRows = salesRows;
    const effectiveSpendRows = spendRows.filter((r) => {
      const category = String(r.category ?? "광고비").trim();
      return category === "광고비" || category === "기타지출" || category === "고정지출";
    });

    // ---------- 신규 합산 (대표님 정의 정확 매칭) ----------
    let sumCommission = 0;
    let sumVas = 0;
    let sumReceivable = 0;
    let sumVoucher = 0;
    let sumTradeIn = 0;
    let sumDistributor = 0;
    let sumCashOpen = 0;
    let sumExtraSubsidy = 0;
    let sumCustomerSupport = 0;
    let sumCorpCard = 0;
    let sumMoyoFee = 0;
    for (const r of settledSalesRows) {
      const p = calcDashboardProfit(r);
      sumCommission += p.salesCommission;
      sumVas += p.vasFee;
      sumReceivable += p.receivableAmount;
      sumVoucher += p.voucherAmount;
      sumTradeIn += p.tradeInConfirmed;
      sumDistributor += p.distributor;
      sumCashOpen += p.cashSupport;
      sumExtraSubsidy += p.offerSubsidy;
      sumCustomerSupport += p.customerSupport;
      sumCorpCard += p.cardSubsidy;
      sumMoyoFee += p.moyoFee;
    }
    // ---------- 합계 ----------
    let totalRevenue = 0;
    let totalDistributor = 0;
    let totalCashOpen = 0;
    let totalCustomerDeposit = 0;
    let totalOffer = 0;
    let totalSuccess = 0;
    let moyoAppliedCount = 0;
    let moyoExcludedCount = 0;
    for (const r of settledSalesRows) {
      totalSuccess += 1;
      totalRevenue += Number(r.unit_price ?? 0);
      totalDistributor += Number(r.distributor_amount ?? 0);
      totalCashOpen += Number(r.cash_support_amount ?? 0);
      totalCustomerDeposit += Number(r.receivable_amount ?? 0);
      totalOffer +=
        Number(r.cash_support_amount ?? 0) + Number(r.extra_subsidy ?? 0);
      // 모요 채널 분류 (모바일 가입 건만 카운트)
      const ch = (r.channel ?? "").toString().trim();
      const prod = (r.product ?? "").toString().trim();
      if (ch === "모요" && prod === "모바일") {
        if (r.moyo_excluded) {
          moyoExcludedCount += 1;
        } else {
          moyoAppliedCount += 1;
        }
      }
    }
    const moyoFee = sumMoyoFee;
    const totalAdSpend = effectiveSpendRows.reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );
    const totalFixedExpense = spendRows
      .filter((r) => String(r.category ?? "").trim() === "고정지출")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalAdOnly = spendRows
      .filter((r) => String(r.category ?? "").trim() === "광고비")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const totalEtcOnly = spendRows
      .filter((r) => String(r.category ?? "").trim() === "기타지출")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);

    // --- 항목별 세부 금액 (field_mapping 기반) ---
    const totalVasFee = settledSalesRows.reduce((s, r) => s + Number(r.vas_fee ?? 0), 0);
    const totalNetFee = settledSalesRows.reduce((s, r) => s + Number(r.net_fee ?? 0), 0);
    const totalExtraSubsidy = settledSalesRows.reduce((s, r) => s + Number(r.extra_subsidy ?? 0), 0);

    const fieldAmountMap: Record<string, number> = {
      unit_price: sumCommission,
      vas_fee: totalVasFee,
      net_fee: totalNetFee,
      distributor_amount: totalDistributor,
      cash_support_amount: totalCashOpen,
      extra_subsidy: totalExtraSubsidy,
      receivable_amount: sumReceivable,
      voucher_amount: sumVoucher,
      trade_in_confirmed: sumTradeIn,
      customer_support_amount: sumCustomerSupport,
      corp_card_amount: sumCorpCard,
      moyo_fee: moyoFee,
      ad_spend: totalAdSpend,
    };

    const categoryBreakdown = categories.map((c) => ({
      label: c.label,
      type: c.category_type,
      amount: c.field_mapping ? (fieldAmountMap[c.field_mapping] ?? 0) : 0,
      included: c.dashboard_included,
      isIncludedInBase: (c as any).is_included_in_base ?? false,
    }));

    // ---------- 신규 정의: 수익/지출 브레이크다운 ----------
    // 0원이라도 항상 표기하여 데이터 정합성 검증 가능하도록 filter 제거
    const revenueBreakdown = [
      { key: "commission", label: "단가표 수수료 합계", amount: sumCommission },
      { key: "vas", label: "부가서비스 수수료 합계", amount: sumVas },
      { key: "receivable", label: "미수금 수급 합계", amount: sumReceivable },
      { key: "voucher", label: "상품권 반납 합계", amount: sumVoucher },
      { key: "trade_in", label: "중고폰 반납 합계", amount: sumTradeIn },
    ];
    const expenseBreakdown = [
      { key: "distributor", label: "유통망 지원금", amount: sumDistributor },
      { key: "cash_open", label: "현금개통 금액", amount: sumCashOpen },
      { key: "extra_subsidy", label: "추가 지원금", amount: sumExtraSubsidy },
      { key: "customer_support", label: "고객 지원금", amount: sumCustomerSupport },
      { key: "corp_card", label: "5번 법인카드 결제금액", amount: sumCorpCard },
      { key: "ad_spend", label: "광고비", amount: totalAdOnly },
      { key: "etc_spend", label: "기타지출", amount: totalEtcOnly },
      { key: "fixed_spend", label: "고정지출", amount: totalFixedExpense },
      { key: "moyo_fee", label: "모요 수수료", amount: sumMoyoFee },
    ];

    const computedRevenue = revenueBreakdown.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenseBreakdown.reduce((s, r) => s + r.amount, 0);
    const netMargin = computedRevenue - totalExpense;
    const roi = totalExpense > 0 ? (netMargin / totalExpense) * 100 : 0;    
    const cpaAvg = totalSuccess > 0 ? totalAdSpend / totalSuccess : 0;
    const marginRate = computedRevenue > 0 ? (netMargin / computedRevenue) * 100 : 0;

    // ---------- 채널별 ----------
    const channelMap = new Map<
      string,
      { spend: number; successCount: number; rebate: number; offer: number }
    >();
    const ensure = (name: string) => {
      if (!channelMap.has(name))
        channelMap.set(name, { spend: 0, successCount: 0, rebate: 0, offer: 0 });
      return channelMap.get(name)!;
    };
    for (const r of settledSalesRows) {
      const ch = (r.channel ?? "기타").toString().trim() || "기타";
      const row = ensure(ch);
      const p = calcDashboardProfit(r);
      row.successCount += 1;
      row.rebate += p.revenue;
      row.offer += p.expense;
    }
    for (const r of effectiveSpendRows) {
      const ch = (r.channel ?? r.media ?? "기타").toString().trim() || "기타";
      ensure(ch).spend += Number(r.amount ?? 0);
    }
    const channels: FinanceChannelRow[] = Array.from(channelMap.entries())
      .map(([channel, v]) => {
        const cost = v.spend + v.offer;
        const margin = v.rebate - cost;
        return {
          channel,
          spend: v.spend,
          successCount: v.successCount,
          rebate: v.rebate,
          offer: v.offer,
          avgOffer: v.successCount > 0 ? v.offer / v.successCount : 0,
          cpa: v.successCount > 0 ? v.spend / v.successCount : 0,
          cost,
          margin,
          marginRate: v.rebate > 0 ? (margin / v.rebate) * 100 : 0,
        };
      })
      .sort((a, b) => b.rebate + b.spend - (a.rebate + a.spend));

    // ---------- 매체별 합계 + 일별 스택 ----------
    const mediaSet = new Set<string>();
    const buckets = new Map<string, FinanceDailyPoint>();
    const start = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      buckets.set(iso, {
        date: iso,
        day: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
        total: 0,
      });
    }
    const mediaTotalsMap = new Map<string, number>();
    for (const r of effectiveSpendRows) {
      const m = (r.media ?? "기타").toString();
      mediaSet.add(m);
      mediaTotalsMap.set(m, (mediaTotalsMap.get(m) ?? 0) + Number(r.amount ?? 0));
      const b = buckets.get(r.spend_date);
      if (b) {
        b[m] = (Number(b[m] ?? 0) as number) + Number(r.amount ?? 0);
        b.total += Number(r.amount ?? 0);
      }
    }
    const mediaList = Array.from(mediaSet);
    const mediaTotals: FinanceMediaTotal[] = Array.from(
      mediaTotalsMap.entries(),
    )
      .map(([media, total]) => ({ media, total }))
      .sort((a, b) => b.total - a.total);
    const daily = Array.from(buckets.values());

    // ---------- 상품별 수익 구성 ----------
    const productMap = new Map<string, number>();
    for (const r of settledSalesRows) {
      const key = (r.product ?? "기타").toString().trim() || "기타";
      productMap.set(key, (productMap.get(key) ?? 0) + calcDashboardProfit(r).revenue);
    }
    const products: FinanceProductRow[] = Array.from(productMap.entries())
      .filter(([, v]) => v > 0)
      .map(([item, amount]) => ({
        item,
        amount,
        color: PRODUCT_PALETTE[item] ?? "hsl(220 10% 60%)",
      }))
      .sort((a, b) => b.amount - a.amount);

    // ---------- 주차별 채널별 평균 오퍼 ----------
    const offerMap = new Map<string, Map<string, { sum: number; cnt: number }>>();
    for (const r of settledSalesRows) {
      if (!r.open_date) continue;
      const wk = isoWeekKey(r.open_date);
      const ch = (r.channel ?? "기타").toString();
      if (!offerMap.has(wk)) offerMap.set(wk, new Map());
      const w = offerMap.get(wk)!;
      if (!w.has(ch)) w.set(ch, { sum: 0, cnt: 0 });
      const cell = w.get(ch)!;
      cell.sum += calcDashboardProfit(r).expense;
      cell.cnt += 1;
    }
    const channelNames = channels.map((c) => c.channel);
    const offerWeekly: FinanceWeeklyOffer[] = Array.from(offerMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, m]) => {
        const row: FinanceWeeklyOffer = { week };
        channelNames.forEach((c) => {
          const cell = m.get(c);
          row[c] = cell && cell.cnt > 0 ? Math.round(cell.sum / cell.cnt) : 0;
        });
        return row;
      });

    return {
      loading,
      excludedLabels,
      totalRevenue: computedRevenue,
      totalAdSpend,
      totalDistributor,
      totalCustomerDeposit,
      totalCashOpen,
      totalOffer,
      totalSuccess,
      totalExpense,
      netMargin,
      roi,
      cpaAvg,
      marginRate,
      moyoAppliedCount,
      moyoExcludedCount,
      moyoFee,
      channels,
      mediaTotals,
      daily,
      mediaList,
      products,
      offerWeekly,
      channelNames,
      categoryBreakdown,
      revenueBreakdown,
      expenseBreakdown,
      hasSales: totalSuccess > 0,
      hasSpend: totalAdSpend > 0,
    };
  }, [salesRows, spendRows, startDate, endDate, loading, categories, includedExpenseLabels, excludedLabels]);
}
