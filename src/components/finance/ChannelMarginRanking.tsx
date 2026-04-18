import { channelEconomics, formatKRWShort } from "@/data/financeData";
import { Crown, Trophy, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

export const ChannelMarginRanking = () => {
  const rows = channelEconomics
    .map((c) => {
      const cost = c.spend + c.offer;
      const margin = c.rebate - cost;
      const marginRate = Math.round((margin / c.rebate) * 100);
      return { ...c, margin, marginRate, cost };
    })
    .sort((a, b) => b.marginRate - a.marginRate);

  const podium = [
    { wrap: "from-amber-400/30 to-orange-500/10 ring-amber-400/40 text-amber-300", Icon: Crown },
    { wrap: "from-slate-300/25 to-slate-500/5 ring-slate-300/40 text-slate-200", Icon: Trophy },
    { wrap: "from-orange-700/30 to-amber-800/10 ring-orange-600/40 text-orange-300", Icon: Medal },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold tracking-tight">채널별 마진율 순위</h4>
          <p className="text-xs text-muted-foreground mt-0.5">(리베이트 − 지원금 − 광고비) ÷ 리베이트</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {rows.slice(0, 3).map((r, i) => {
          const P = podium[i];
          return (
            <div key={r.channel} className={cn("rounded-xl p-3 ring-1 backdrop-blur-md bg-gradient-to-br", P.wrap)}>
              <div className="flex items-center justify-between">
                <P.Icon className="size-4" />
                <span className="text-[10px] font-bold">#{i + 1}</span>
              </div>
              <div className="mt-2 text-sm font-semibold">{r.channel}</div>
              <div className="mt-1 text-2xl font-bold text-gradient tabular-nums">{r.marginRate}%</div>
              <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                마진 {formatKRWShort(r.margin)}
              </div>
            </div>
          );
        })}
      </div>

      <ul className="space-y-1.5">
        {rows.slice(3).map((r, idx) => (
          <li key={r.channel} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground tabular-nums w-5">{idx + 4}</span>
              <span className="text-sm font-medium">{r.channel}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground tabular-nums">{formatKRWShort(r.margin)}</span>
              <span className="text-sm font-bold tabular-nums text-revenue">{r.marginRate}%</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
