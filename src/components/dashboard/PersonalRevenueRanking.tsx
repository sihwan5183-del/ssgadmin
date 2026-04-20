import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Medal, Trophy, ArrowRight, Search, User } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PersonPerformanceDrawer } from "./PersonPerformanceDrawer";

interface PersonRow {
  key: string; // user_id 또는 manager 이름
  name: string;
  team: string;
  count: number;
  profit: number;
  isMe: boolean;
}

/**
 * 개인별 수익 랭킹 — 매장 단위 X, 직원 단위 O
 * 1~3위 메달 / 4~5위 트로피 / 본인 강조 / 클릭 시 드릴다운
 */
export const PersonalRevenueRanking = () => {
  const { startDate, endDate } = usePeriod();
  const { user } = useAuth();
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [profileRows, setProfileRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PersonRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: sales }, { data: profiles }] = await Promise.all([
        supabase
          .from("sales")
          .select("created_by, manager, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
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

  const ranked = useMemo<PersonRow[]>(() => {
    const profileMap = new Map((profileRows ?? []).map((p: any) => [p.user_id, p]));
    const map = new Map<string, PersonRow>();
    salesRows.forEach((r) => {
      const profile = profileMap.get(r.created_by);
      const name = profile?.display_name || r.manager || "미지정";
      const team = profile?.team || "-";
      const key = r.created_by || name;
      const profit =
        (Number(r.net_fee) || 0) -
        (Number(r.distributor_amount) || 0) -
        (Number(r.cash_support_amount) || 0) -
        (Number(r.extra_subsidy) || 0);
      const cur = map.get(key) ?? { key, name, team, count: 0, profit: 0, isMe: false };
      cur.count += 1;
      cur.profit += profit;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((r) => ({ ...r, isMe: !!user && r.key === user.id }))
      .sort((a, b) => b.profit - a.profit);
  }, [salesRows, profileRows, user]);

  const myRank = useMemo(() => {
    const idx = ranked.findIndex((r) => r.isMe);
    return idx >= 0 ? idx + 1 : null;
  }, [ranked]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ranked;
    return ranked.filter((r) => r.name.toLowerCase().includes(q) || r.team.toLowerCase().includes(q));
  }, [ranked, query]);

  const top5 = ranked.slice(0, 5);
  const restAll = ranked.slice(5);
  const showFiltered = query.trim().length > 0;

  const medalFor = (rank: number) => {
    if (rank === 1)
      return {
        Icon: Crown,
        wrap: "bg-gradient-to-br from-amber-400/30 to-orange-500/10 ring-amber-400/50",
        color: "text-amber-300",
        label: "GOLD",
      };
    if (rank === 2)
      return {
        Icon: Trophy,
        wrap: "bg-gradient-to-br from-slate-200/25 to-slate-400/10 ring-slate-300/50",
        color: "text-slate-200",
        label: "SILVER",
      };
    if (rank === 3)
      return {
        Icon: Medal,
        wrap: "bg-gradient-to-br from-orange-700/30 to-amber-800/10 ring-orange-500/50",
        color: "text-orange-300",
        label: "BRONZE",
      };
    return {
      Icon: Medal,
      wrap: "bg-gradient-to-br from-primary/15 to-primary/5 ring-primary/30",
      color: "text-primary",
      label: `TOP ${rank}`,
    };
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Crown className="size-5 text-primary" />
            개인별 수익 랭킹
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            전사 직원 {ranked.length}명 · 클릭 시 채널/가입유형 상세 분석
          </p>
        </div>
        {myRank && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
            <User className="size-3.5" /> 내 순위 #{myRank}
          </div>
        )}
      </div>

      {/* 상위 5명 메달 */}
      {!loading && top5.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {top5.map((r, i) => {
            const m = medalFor(i + 1);
            const Icon = m.Icon;
            return (
              <button
                key={r.key}
                onClick={() => setSelected(r)}
                className={cn(
                  "rounded-xl p-3 ring-1 backdrop-blur-md text-left transition-all hover:scale-[1.02]",
                  m.wrap,
                  r.isMe && "outline outline-2 outline-primary"
                )}
              >
                <div className="flex items-center justify-between">
                  <Icon className={cn("size-4", m.color)} />
                  <span className={cn("text-[9px] font-extrabold tracking-wider", m.color)}>{m.label}</span>
                </div>
                <div className="mt-2 text-sm font-semibold truncate flex items-center gap-1">
                  {r.name}
                  {r.isMe && <span className="text-[9px] px-1 rounded bg-primary text-primary-foreground">나</span>}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {r.team} · {r.count}건
                </div>
                <div className="mt-1.5 text-base font-bold text-gradient tabular-nums">{formatShortKRW(r.profit)}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* 검색 */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름 / 팀 검색"
          className="pl-9 h-9 text-sm"
        />
      </div>

      {loading ? (
        <div className="py-10 text-sm text-muted-foreground text-center">불러오는 중…</div>
      ) : ranked.length === 0 ? (
        <div className="py-10 text-sm text-muted-foreground text-center">데이터가 없습니다</div>
      ) : (
        <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {(showFiltered ? filtered : restAll).map((r) => {
            const rank = ranked.findIndex((x) => x.key === r.key) + 1;
            return (
              <li key={r.key}>
                <button
                  onClick={() => setSelected(r)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-left",
                    r.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "text-xs font-bold tabular-nums w-8 text-center",
                        rank <= 3 ? "text-amber-400" : rank <= 5 ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      #{rank}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {r.name}
                        {r.isMe && (
                          <span className="text-[9px] px-1 rounded bg-primary text-primary-foreground">나</span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {r.team} · {r.count}건
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">{formatShortKRW(r.profit)}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </div>
                </button>
              </li>
            );
          })}
          {showFiltered && filtered.length === 0 && (
            <li className="text-center text-xs text-muted-foreground py-4">검색 결과가 없습니다</li>
          )}
        </ul>
      )}

      <PersonPerformanceDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        personKey={selected?.key ?? null}
        personName={selected?.name ?? null}
      />
    </div>
  );
};
