import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { calcDashboardProfit } from "@/lib/profit";

interface ChannelRow {
  channel: string;
  count: number;       // 개통완료 건수
  inquiries: number;   // 인입 건수
  revenue: number;     // 판매수수료 + 상품권 금액
  expense: number;     // 오퍼/카드 추가지원금 + 모요 수수료
  moyoFee: number;     // 모요 수수료
  profit: number;      // 순수익
  successRate: number; // 인입 대비 성공률
  efficiency: number;  // 비용 대비 실질 순수익률 %
}

const NEON = [
  "hsl(330 100% 60%)",
  "hsl(280 90% 65%)",
  "hsl(195 90% 60%)",
  "hsl(158 70% 55%)",
  "hsl(38 95% 60%)",
  "hsl(345 95% 65%)",
  "hsl(220 90% 65%)",
  "hsl(310 90% 65%)",
];

/**
 * 채널별 효율 분석
 * 성공률과 비용 대비 실질 순수익률 기준 시각화
 */
export const StoreEfficiencyBubble = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [salesRes, inquiriesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("channel, unit_price, vas_fee, receivable_amount, receivable_paid, voucher, voucher_returned, trade_in_enabled, trade_in_confirmed, distributor_amount, cash_support_amount, cash_open, extra_subsidy, customer_support_amount, corp_card_amount, custom_fields, moyo_excluded")
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .eq("status", "개통완료")
          .limit(10000),
        supabase
          .from("inquiries")
          .select("channel")
          .gte("inquiry_date", startDate)
          .lte("inquiry_date", endDate)
          .limit(10000),
      ]);
      if (!alive) return;

      const inquiryMap = new Map<string, number>();
      (inquiriesRes.data ?? []).forEach((r: any) => {
        const ch = (r.channel || "기타").toString().trim() || "기타";
        inquiryMap.set(ch, (inquiryMap.get(ch) ?? 0) + 1);
      });

      const map = new Map<string, ChannelRow>();
      (salesRes.data ?? []).forEach((r: any) => {
        const ch = (r.channel || "기타").toString().trim() || "기타";
        const { revenue, expense, moyoFee, profit } = calcDashboardProfit(r);

        const cur = map.get(ch) ?? { channel: ch, count: 0, inquiries: 0, revenue: 0, expense: 0, moyoFee: 0, profit: 0, successRate: 0, efficiency: 0 };
        cur.count += 1;
        cur.revenue += revenue;
        cur.expense += expense;
        cur.moyoFee += moyoFee;
        cur.profit += profit;
        map.set(ch, cur);
      });
      const arr = Array.from(map.values()).map((c) => ({
        ...c,
        inquiries: Math.max(inquiryMap.get(c.channel) ?? 0, c.count),
        successRate: Math.max(inquiryMap.get(c.channel) ?? 0, c.count) > 0 ? (c.count / Math.max(inquiryMap.get(c.channel) ?? 0, c.count)) * 100 : 0,
        efficiency: c.expense > 0 ? (c.profit / c.expense) * 100 : c.profit > 0 ? 100 : 0,
      }));
      arr.sort((a, b) => b.profit - a.profit);
      setRows(arr);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const maxAbsProfit = useMemo(() => Math.max(1, ...rows.map((r) => Math.abs(r.profit))), [rows]);

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            채널별 효율 분석
          </h3>
          <p className="text-xs text-muted-foreground mt-1">성공률 + 비용 대비 실질 순수익 · 5번 법인카드/모요 수수료 반영</p>
        </div>
      </div>

      {loading ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">데이터가 없습니다</div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r, i) => {
            const widthPct = (Math.abs(r.profit) / maxAbsProfit) * 100;
            const positive = r.profit >= 0;
            const TrendIcon = positive ? TrendingUp : TrendingDown;
            const color = NEON[i % NEON.length];
            return (
              <div key={r.channel} className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-semibold text-sm">{r.channel}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">개통 {r.count}건</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">성공 {r.successRate.toFixed(1)}%</span>
                    {r.moyoFee > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/30">
                        모요 -{formatShortKRW(r.moyoFee)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground leading-tight">순수익</div>
                      <div className={`font-bold text-sm tabular-nums ${positive ? "text-foreground" : "text-destructive"}`}>
                        {formatShortKRW(r.profit)}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums ${positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                      <TrendIcon className="size-3" />
                      ROI {r.efficiency.toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(widthPct, 2)}%`, background: positive ? color : "hsl(var(--destructive))" }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 tabular-nums">
                  <span>인입 {r.inquiries}건 · 수익 {formatShortKRW(r.revenue)}</span>
                  <span>투입비용 {formatShortKRW(r.expense)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
