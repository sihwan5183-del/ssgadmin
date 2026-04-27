import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";

interface ChannelRow {
  channel: string;
  count: number;       // 인입(개통완료) 건수
  revenue: number;     // 수수료 + VAS
  expense: number;     // 지원금 합
  moyoFee: number;     // 모요 수수료
  profit: number;      // 순수익
  efficiency: number;  // 수익률 % = profit / revenue * 100
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
 * 인입 대비 순수익(%) 기준 시각화
 * 모요 수수료(88,000/건, moyo_excluded=false인 건만) 차감 반영
 */
export const StoreEfficiencyBubble = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("channel, net_fee, vas_fee, distributor_amount, extra_subsidy, cash_support_amount, customer_support_amount, corp_card_amount, voucher, voucher_returned, moyo_excluded")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .eq("status", "개통완료")
        .limit(10000);
      if (!alive) return;

      const map = new Map<string, ChannelRow>();
      (data ?? []).forEach((r: any) => {
        const voucherExcluded = r.voucher && String(r.voucher).trim() !== "" && r.voucher_returned !== "유";
        if (voucherExcluded) return;

        const ch = (r.channel || "기타").toString().trim() || "기타";
        const revenue = (Number(r.net_fee) || 0) + (Number(r.vas_fee) || 0);
        const expense =
          (Number(r.distributor_amount) || 0) +
          (Number(r.extra_subsidy) || 0) +
          (Number(r.cash_support_amount) || 0) +
          (Number(r.customer_support_amount) || 0) +
          (Number(r.corp_card_amount) || 0);
        const moyoFee = (ch === "모요" && !r.moyo_excluded) ? 88000 : 0;
        const profit = revenue - expense - moyoFee;

        const cur = map.get(ch) ?? { channel: ch, count: 0, revenue: 0, expense: 0, moyoFee: 0, profit: 0, efficiency: 0 };
        cur.count += 1;
        cur.revenue += revenue;
        cur.expense += expense;
        cur.moyoFee += moyoFee;
        cur.profit += profit;
        map.set(ch, cur);
      });
      const arr = Array.from(map.values()).map((c) => ({
        ...c,
        efficiency: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0,
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
          <p className="text-xs text-muted-foreground mt-1">인입 대비 순수익률(%) · 모요 수수료(88,000원/건) 차감 반영</p>
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.count}건</span>
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
                      {r.efficiency.toFixed(1)}%
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
                  <span>수익 {formatShortKRW(r.revenue)}</span>
                  <span>지출 {formatShortKRW(r.expense + r.moyoFee)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
