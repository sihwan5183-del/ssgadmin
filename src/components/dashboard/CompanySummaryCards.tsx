import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Users, Trophy } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";

/**
 * 전사 통합 요약 카드 — 인당 평균 수익 + 최고 성과 채널
 */
export const CompanySummaryCards = () => {
  const { startDate, endDate } = usePeriod();
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("created_by, manager, channel, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!alive) return;
      setSalesRows(data ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const { perPersonAvg, headcount, topChannel, topChannelMargin } = useMemo(() => {
    const persons = new Map<string, number>();
    const channels = new Map<string, number>();
    let totalProfit = 0;

    salesRows.forEach((r) => {
      const profit =
        (Number(r.net_fee) || 0) -
        (Number(r.distributor_amount) || 0) -
        (Number(r.cash_support_amount) || 0) -
        (Number(r.extra_subsidy) || 0);
      totalProfit += profit;
      const pKey = r.created_by || r.manager || "미지정";
      persons.set(pKey, (persons.get(pKey) ?? 0) + profit);
      const ch = r.channel || "기타";
      channels.set(ch, (channels.get(ch) ?? 0) + profit);
    });

    const headcount = persons.size;
    const perPersonAvg = headcount > 0 ? totalProfit / headcount : 0;
    let topChannel = "-";
    let topChannelMargin = 0;
    channels.forEach((v, k) => {
      if (v > topChannelMargin) {
        topChannel = k;
        topChannelMargin = v;
      }
    });
    return { perPersonAvg, headcount, topChannel, topChannelMargin };
  }, [salesRows]);

  return (
    <>
      <div className="glass rounded-2xl p-4 shadow-card-elevated">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">인당 평균 수익</span>
          <Users className="size-4 text-primary" />
        </div>
        <div className="mt-2 text-xl font-bold text-gradient tabular-nums">
          {loading ? "…" : formatShortKRW(perPersonAvg)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">활동 직원 {headcount}명 기준</div>
      </div>

      <div className="glass rounded-2xl p-4 shadow-card-elevated">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">최고 성과 채널</span>
          <Trophy className="size-4 text-amber-400" />
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums truncate">
          {loading ? "…" : topChannel}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          마진 {loading ? "…" : formatShortKRW(topChannelMargin)}
        </div>
      </div>
    </>
  );
};
