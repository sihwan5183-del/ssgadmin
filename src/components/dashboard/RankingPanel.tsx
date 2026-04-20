import { useEffect, useMemo, useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { formatShortKRW } from "@/data/mockData";
import { cn } from "@/lib/utils";

const rankStyles = [
  { wrap: "bg-gradient-to-br from-amber-400/30 to-orange-500/10 ring-amber-400/40", icon: Crown, color: "text-amber-300" },
  { wrap: "bg-gradient-to-br from-slate-300/25 to-slate-500/5 ring-slate-300/40", icon: Trophy, color: "text-slate-200" },
  { wrap: "bg-gradient-to-br from-orange-700/30 to-amber-800/10 ring-orange-600/40", icon: Medal, color: "text-orange-300" },
];

export const RankingPanel = () => {
  const { startDate, endDate } = usePeriod();
  const [tab, setTab] = useState<"team" | "individual">("team");
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [profileRows, setProfileRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: sales }, { data: profiles }] = await Promise.all([
        supabase
          .from("sales")
          .select("created_by, manager, net_fee, distributor_amount, cash_support_amount, receivable_amount")
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .limit(10000),
        supabase.from("profiles").select("user_id, display_name, team").limit(1000),
      ]);
      if (!alive) return;
      setSalesRows(sales ?? []);
      setProfileRows(profiles ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const { teamRanking, employeeRanking } = useMemo(() => {
    const profileMap = new Map((profileRows ?? []).map((row: any) => [row.user_id, row]));
    const teamMap = new Map<string, { team: string; profit: number; members: Set<string> }>();
    const employeeMap = new Map<string, { name: string; team: string; profit: number; count: number }>();

    (salesRows ?? []).forEach((row: any) => {
      const profit = Number(row.net_fee ?? 0) - Number(row.distributor_amount ?? 0) - Number(row.cash_support_amount ?? 0) - Number(row.receivable_amount ?? 0);
      const profile = profileMap.get(row.created_by);
      const team = profile?.team || row.manager || "미지정";
      const name = profile?.display_name || row.manager || "미지정";

      const teamCurrent = teamMap.get(team) ?? { team, profit: 0, members: new Set<string>() };
      teamCurrent.profit += profit;
      if (row.created_by) teamCurrent.members.add(row.created_by);
      teamMap.set(team, teamCurrent);

      const empKey = row.created_by || name;
      const employeeCurrent = employeeMap.get(empKey) ?? { name, team, profit: 0, count: 0 };
      employeeCurrent.profit += profit;
      employeeCurrent.count += 1;
      employeeMap.set(empKey, employeeCurrent);
    });

    const teams = Array.from(teamMap.values())
      .map((row, idx) => ({ rank: idx + 1, team: row.team, profit: row.profit, members: row.members.size || 1, avg: row.profit / Math.max(1, row.members.size || 1) }))
      .sort((a, b) => b.profit - a.profit)
      .map((row, idx) => ({ ...row, rank: idx + 1 }));

    const employees = Array.from(employeeMap.values())
      .sort((a, b) => b.profit - a.profit)
      .map((row, idx) => ({ rank: idx + 1, ...row }));

    return { teamRanking: teams, employeeRanking: employees };
  }, [profileRows, salesRows]);

  const activeRows = tab === "team" ? teamRanking : employeeRanking;

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
      {loading ? (
        <div className="py-10 text-sm text-muted-foreground text-center">불러오는 중…</div>
      ) : activeRows.length === 0 ? (
        <div className="py-10 text-sm text-muted-foreground text-center">선택한 기간의 랭킹 데이터가 없습니다</div>
      ) : (
        <>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {activeRows.slice(0, 3).map((r, i) => {
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
        {activeRows.slice(3).map((r, i) => {
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
        </>
      )}
    </div>
  );
};
