import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

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
            "channel, product, open_date, unit_price, distributor_amount, cash_support_amount, extra_subsidy, receivable_amount",
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
    const totalSuccess = salesRows.length;
    for (const r of salesRows) {
      totalRevenue += Number(r.unit_price ?? 0);
      totalDistributor += Number(r.distributor_amount ?? 0);
      totalCashOpen += Number(r.cash_support_amount ?? 0);
      totalCustomerDeposit += Number(r.receivable_amount ?? 0);
      totalOffer +=
        Number(r.cash_support_amount ?? 0) + Number(r.extra_subsidy ?? 0);
    }
    const totalAdSpend = spendRows.reduce(
      (s, r) => s + Number(r.amount ?? 0),
      0,
    );
    const totalExpense = totalAdSpend + totalDistributor + totalCustomerDeposit;
    const netMargin = totalRevenue - totalExpense;
    const roi = totalExpense > 0 ? (netMargin / totalExpense) * 100 : 0;
    const cpaAvg = totalSuccess > 0 ? totalAdSpend / totalSuccess : 0;
    const marginRate = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;

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
      totalRevenue,
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
      channels,
      mediaTotals,
      daily,
      mediaList,
      products,
      offerWeekly,
      channelNames,
      hasSales: totalSuccess > 0,
      hasSpend: totalAdSpend > 0,
    };
  }, [salesRows, spendRows, startDate, endDate, loading]);
}
