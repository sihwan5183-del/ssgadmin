import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Store, ArrowRight } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";

interface StoreRow {
  store: string;
  count: number;
  profit: number;
}

/**
 * 매장별 수익 수평 막대 차트 — 수익 내림차순 정렬
 * 막대 클릭 시 활동관리 페이지로 매장 필터 적용 이동 (드릴다운)
 */
export const StoreRevenueRanking = () => {
  const { startDate, endDate } = usePeriod();
  const navigate = useNavigate();
  const [rows, setRows] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // sales 데이터를 manager(매장 추정 필드)별 집계 — 실제로는 store join이 이상적
      const { data } = await supabase
        .from("sales")
        .select("manager, net_fee, distributor_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .eq("status", "개통완료")
        .limit(2000);
      if (!alive) return;

      const map = new Map<string, StoreRow>();
      (data ?? []).forEach((r: any) => {
        const key = r.manager || "미지정";
        const profit = (Number(r.net_fee) || 0) - (Number(r.distributor_amount) || 0) - (Number(r.extra_subsidy) || 0);
        const cur = map.get(key) ?? { store: key, count: 0, profit: 0 };
        cur.count += 1;
        cur.profit += profit;
        map.set(key, cur);
      });
      const sorted = Array.from(map.values()).sort((a, b) => b.profit - a.profit).slice(0, 8);
      setRows(sorted);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const max = Math.max(1, ...rows.map((r) => r.profit));

  const getBarColor = (i: number) => {
    if (i === 0) return "linear-gradient(90deg, hsl(330 100% 55%), hsl(345 100% 65%))";
    if (i === 1) return "linear-gradient(90deg, hsl(280 90% 60%), hsl(310 90% 65%))";
    if (i === 2) return "linear-gradient(90deg, hsl(195 90% 55%), hsl(220 90% 60%))";
    return "linear-gradient(90deg, hsl(330 60% 50% / 0.6), hsl(330 60% 60% / 0.6))";
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Store className="size-5 text-primary" />
            매장별 수익 랭킹
          </h3>
          <p className="text-xs text-muted-foreground mt-1">막대 클릭 시 해당 매장 상세로 이동</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 font-bold">
          DRILL-DOWN
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">데이터가 없습니다</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const widthPct = (r.profit / max) * 100;
            return (
              <button
                key={r.store}
                onClick={() => navigate(`/activities?manager=${encodeURIComponent(r.store)}`)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums w-5 text-muted-foreground group-hover:text-primary transition-colors">
                      #{i + 1}
                    </span>
                    <span className="font-semibold text-sm">{r.store}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {r.count}건
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm tabular-nums text-foreground">{formatShortKRW(r.profit)}</span>
                    <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
                <div className="h-3 rounded-full bg-muted/60 overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(widthPct, 2)}%`,
                      background: getBarColor(i),
                      boxShadow: i < 3 ? `0 0 12px hsl(330 100% 55% / 0.4)` : undefined,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
