import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useBudgetCategories, type BudgetCategory } from "./useBudgetCategories";

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
  IOT: "hsl(280 70% 60%)",
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
  const { startDate, endDate } = usePeriod();
  const { categories, includedExpenseLabels, excludedLabels } = useBudgetCategories();
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [spendRows, setSpendRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [salesRes, spendRes] = await Promise.all([
        supabase
          .from("sales")
          .select(
            "channel, product, open_date, unit_price, distributor_amount, cash_support_amount, extra_subsidy, receivable_amount, moyo_excluded, vas_fee, net_fee",
          )
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .limit(10000),
        supabase
          .from("ad_spend")
          .select("media, channel, amount, spend_date")
          .gte("spend_date", startDate)
          .lte("spend_date", endDate)
          .limit(10000),
      ]);
      if (cancelled) return;
      setSalesRows(salesRes.data ?? []);
      setSpendRows(spendRes.data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return useMemo<FinanceData>(() => {
    // ---------- 합계 ----------
    let totalRevenue = 0;
    let totalDistributor = 0;
    let totalCashOpen = 0;
    let totalCustomerDeposit = 0;
    let totalOffer = 0;
    let totalSuccess = 0;
    let moyoAppliedCount = 0;
    let moyoExcludedCount = 0;
    for (const r of salesRows) {
      totalSuccess += 1;
      totalRevenue += Number(r.unit_price ?? 0);
      totalDistributor += Number(r.distributor_amount ?? 0);
      totalCashOpen += Number(r.cash_support_amount ?? 0);
      totalCustomerDeposit += Number(r.receivable_amount ?? 0);
      totalOffer +=
        Number(r.cash_support_amount ?? 0) + Number(r.extra_subsidy ?? 0);
      // 모요 채널 건 분류
      const ch = (r.channel ?? "").toString().trim();
      if (ch === "모요") {
        if (r.moyo_excluded) {
          moyoExcludedCount += 1;
        } else {
          moyoAppliedCount += 1;
        }
      }
    }
    const moyoFee = moyoAppliedCount * 88000;
    const totalAdSpend = spendRows.reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );

    // --- 항목별 세부 금액 (field_mapping 기반) ---
    const totalVasFee = salesRows.reduce((s, r) => s + Number(r.vas_fee ?? 0), 0);
    const totalNetFee = salesRows.reduce((s, r) => s + Number(r.net_fee ?? 0), 0);
    const totalExtraSubsidy = salesRows.reduce((s, r) => s + Number(r.extra_subsidy ?? 0), 0);

    const fieldAmountMap: Record<string, number> = {
      unit_price: totalRevenue,
      vas_fee: totalVasFee,
      net_fee: totalNetFee,
      distributor_amount: totalDistributor,
      cash_support_amount: totalCashOpen,
      extra_subsidy: totalExtraSubsidy,
      receivable_amount: totalCustomerDeposit,
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

    // 동적 합산: field_mapping 기반으로 On 항목만 합산
    let dynamicExpense = 0;
    let dynamicRevenue = 0;
    for (const c of categories) {
      const amt = c.field_mapping ? (fieldAmountMap[c.field_mapping] ?? 0) : 0;
      if (!c.dashboard_included) continue;
      // is_included_in_base가 true이면 상위 항목에 이미 포함 → 합산에서 제외
      if ((c as any).is_included_in_base) continue;
      if (c.category_type === "지출") dynamicExpense += amt;
      if (c.category_type === "수익") dynamicRevenue += amt;
    }
    const totalExpense = dynamicExpense;
    const computedRevenue = dynamicRevenue > 0 ? dynamicRevenue : totalRevenue;
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
    for (const r of salesRows) {
      const ch = (r.channel ?? "기타").toString().trim() || "기타";
      const row = ensure(ch);
      row.successCount += 1;
      row.rebate += Number(r.unit_price ?? 0);
      row.offer +=
        Number(r.cash_support_amount ?? 0) + Number(r.extra_subsidy ?? 0);
    }
    for (const r of spendRows) {
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
    for (const r of spendRows) {
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
    for (const r of salesRows) {
      const key = (r.product ?? "기타").toString().trim() || "기타";
      productMap.set(key, (productMap.get(key) ?? 0) + Number(r.unit_price ?? 0));
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
    for (const r of salesRows) {
      if (!r.open_date) continue;
      const wk = isoWeekKey(r.open_date);
      const ch = (r.channel ?? "기타").toString();
      if (!offerMap.has(wk)) offerMap.set(wk, new Map());
      const w = offerMap.get(wk)!;
      if (!w.has(ch)) w.set(ch, { sum: 0, cnt: 0 });
      const cell = w.get(ch)!;
      cell.sum +=
        Number(r.cash_support_amount ?? 0) + Number(r.extra_subsidy ?? 0);
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
      hasSales: totalSuccess > 0,
      hasSpend: totalAdSpend > 0,
    };
  }, [salesRows, spendRows, startDate, endDate, loading, categories, includedExpenseLabels, excludedLabels]);
}
