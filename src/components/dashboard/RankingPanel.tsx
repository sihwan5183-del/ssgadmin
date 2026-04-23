import { useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { employeeRanking, teamRanking, formatShortKRW } from "@/data/mockData";
import { cn } from "@/lib/utils";

const rankStyles = [
  { wrap: "bg-gradient-to-br from-amber-100 to-orange-100 ring-amber-400", icon: Crown, color: "text-amber-700" },
  { wrap: "bg-gradient-to-br from-slate-300/25 to-slate-500/5 ring-slate-300/40", icon: Trophy, color: "text-slate-200" },
  { wrap: "bg-gradient-to-br from-orange-100 to-amber-100 ring-orange-400", icon: Medal, color: "text-orange-700" },
];

export const RankingPanel = () => {
  const [tab, setTab] = useState<"team" | "individual">("team");

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">실적 랭킹</h3>
          <p className="text-xs text-muted-foreground mt-1">당월 누적 순이익 기준</p>
        </div>
        <div className="flex p-1 rounded-xl bg-muted/60 text-xs">
          {(["team", "individual"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "px-3 py-1.5 rounded-lg font-medium transition-all",
                tab === k ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {k === "team" ? "팀별" : "개인별"}
            </button>
          ))}
        </div>
      </div>

      {/* Top 3 강조 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {(tab === "team" ? teamRanking.slice(0, 3) : employeeRanking.slice(0, 3)).map((r, i) => {
          const S = rankStyles[i];
          const Icon = S.icon;
          const name = "name" in r ? r.name : r.team;
          const sub = "team" in r && "name" in r ? r.team : `${(r as any).members}명`;
          return (
            <div key={i} className={cn("rounded-xl p-3 ring-1 backdrop-blur-md", S.wrap)}>
              <div className="flex items-center justify-between">
                <Icon className={cn("size-4", S.color)} />
                <span className={cn("text-[10px] font-bold", S.color)}>#{i + 1}</span>
              </div>
              <div className="mt-2 text-sm font-semibold truncate">{name}</div>
              <div className="text-[10px] text-muted-foreground">{sub}</div>
              <div className="mt-2 text-base font-bold text-gradient">{formatShortKRW(r.profit)}</div>
            </div>
          );
        })}
      </div>

      <ul className="space-y-1.5">
        {(tab === "team" ? teamRanking.slice(3) : employeeRanking.slice(3)).map((r, i) => {
          const name = "name" in r ? r.name : r.team;
          return (
            <li key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums w-6">{r.rank}</span>
                <span className="text-sm font-medium">{name}</span>
                {"team" in r && "name" in r && (
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">{r.team}</span>
                )}
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatShortKRW(r.profit)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
