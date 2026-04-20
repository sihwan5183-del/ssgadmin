import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Users, Trophy, Sparkles } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { classifySale, pureProfit, upsellExtraRevenue } from "@/lib/salesCategory";

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
        .select("created_by, manager, channel, product, vas1, vas2, vas_fee, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(20000);
      if (!alive) return;
      setSalesRows(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const { perPersonAvg, headcount, topChannel, topChannelMargin, upsellExtra } = useMemo(() => {
    const persons = new Map<string, number>();
    const channels = new Map<string, number>();
    let totalProfit = 0;
    let upsellExtra = 0;

    salesRows.forEach((r) => {
      const profit = pureProfit(r);
      totalProfit += profit;
      const pKey = r.created_by || r.manager || "미지정";
      persons.set(pKey, (persons.get(pKey) ?? 0) + profit);
      const ch = r.channel || "기타";
      channels.set(ch, (channels.get(ch) ?? 0) + profit);
      if (classifySale(r) === "upsell") upsellExtra += upsellExtraRevenue(r);
    });

    const headcount = persons.size;
    const perPersonAvg = headcount > 0 ? totalProfit / headcount : 0;
    let topChannel = "-";
    let topChannelMargin = 0;
    channels.forEach((v, k) => {
      if (v > topChannelMargin) { topChannel = k; topChannelMargin = v; }
    });
    return { perPersonAvg, headcount, topChannel, topChannelMargin, upsellExtra };
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

      <div className="glass rounded-2xl p-4 shadow-card-elevated">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">업셀 부가 수익</span>
          <Sparkles className="size-4 text-warning" />
        </div>
        <div className="mt-2 text-xl font-bold tabular-nums text-gradient">
          {loading ? "…" : formatShortKRW(upsellExtra)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">VAS+net · 개통 별도 집계</div>
      </div>
    </>
  );
};
