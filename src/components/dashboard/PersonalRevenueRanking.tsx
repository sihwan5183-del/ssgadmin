import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAuth } from "@/contexts/AuthContext";
import { Crown, Medal, Trophy, ArrowRight, Search, User, Award } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { PersonPerformanceDrawer } from "./PersonPerformanceDrawer";
import { classifySale, pureProfit, upsellExtraRevenue, DEFAULT_CATEGORY_META } from "@/lib/salesCategory";
import { useCategoryWeights } from "@/hooks/useCategoryWeights";

interface PersonRow {
  key: string;
  name: string;
  team: string;
  count: number; // 모바일+홈 (업셀 제외)
  profit: number;
  byCat: { mobile: number; home: number; upsell: number }; // 카테고리별 순수 수익
  cntCat: { mobile: number; home: number; upsell: number };
  upsellExtra: number;
  score: number; // 가중점수
  isMe: boolean;
}

export const PersonalRevenueRanking = () => {
  const { startDate, endDate } = usePeriod();
  const { user } = useAuth();
  const { weights } = useCategoryWeights();
  const [salesRows, setSalesRows] = useState<any[]>([]);
  const [profileRows, setProfileRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"profit" | "score">("profit");
  const [selected, setSelected] = useState<PersonRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: sales }, { data: profiles }] = await Promise.all([
        supabase
          .from("sales")
          .select("created_by, manager, product, vas1, vas2, vas_fee, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .limit(20000),
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
      const cat = classifySale(r);
      const prof = pureProfit(r);
      const cur =
        map.get(key) ??
        ({
          key,
          name,
          team,
          count: 0,
          profit: 0,
          byCat: { mobile: 0, home: 0, upsell: 0 },
          cntCat: { mobile: 0, home: 0, upsell: 0 },
          upsellExtra: 0,
          score: 0,
          isMe: false,
        } as PersonRow);
      cur.byCat[cat] += prof;
      cur.cntCat[cat] += 1;
      cur.profit += prof;
      if (cat === "upsell") cur.upsellExtra += upsellExtraRevenue(r);
      else cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        isMe: !!user && r.key === user.id,
        score:
          r.cntCat.mobile * weights.mobile +
          r.cntCat.home * weights.home +
          r.cntCat.upsell * weights.upsell,
      }))
      .sort((a, b) => (sortBy === "score" ? b.score - a.score : b.profit - a.profit));
  }, [salesRows, profileRows, user, weights, sortBy]);

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
    if (rank === 1) return { Icon: Crown, wrap: "bg-gradient-to-br from-amber-400/30 to-orange-500/10 ring-amber-400/50", color: "text-amber-300", label: "GOLD" };
    if (rank === 2) return { Icon: Trophy, wrap: "bg-gradient-to-br from-slate-200/25 to-slate-400/10 ring-slate-300/50", color: "text-slate-200", label: "SILVER" };
    if (rank === 3) return { Icon: Medal, wrap: "bg-gradient-to-br from-orange-700/30 to-amber-800/10 ring-orange-500/50", color: "text-orange-300", label: "BRONZE" };
    return { Icon: Medal, wrap: "bg-gradient-to-br from-primary/15 to-primary/5 ring-primary/30", color: "text-primary", label: `TOP ${rank}` };
  };

  const StackBar = ({ row }: { row: PersonRow }) => {
    const total = Math.max(1, row.byCat.mobile + row.byCat.home + row.byCat.upsell);
    const m = (row.byCat.mobile / total) * 100;
    const h = (row.byCat.home / total) * 100;
    const u = (row.byCat.upsell / total) * 100;
    return (
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted/40">
        <div style={{ width: `${m}%`, background: DEFAULT_CATEGORY_META.mobile.color }} title={`모바일 ${formatShortKRW(row.byCat.mobile)}`} />
        <div style={{ width: `${h}%`, background: DEFAULT_CATEGORY_META.home.color }} title={`홈 ${formatShortKRW(row.byCat.home)}`} />
        <div style={{ width: `${u}%`, background: DEFAULT_CATEGORY_META.upsell.color }} title={`업셀 ${formatShortKRW(row.byCat.upsell)}`} />
      </div>
    );
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Crown className="size-5 text-primary" />
            개인별 수익 랭킹
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            전사 직원 {ranked.length}명 · 카테고리 스택 + 가중 성과 점수
          </p>
        </div>
        {myRank && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
            <User className="size-3.5" /> 내 순위 #{myRank}
          </div>
        )}
      </div>

      {/* 정렬 토글 + 범례 */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="inline-flex p-1 rounded-lg bg-muted/50 border border-border/40 text-xs">
          <button
            onClick={() => setSortBy("profit")}
            className={cn("px-2.5 py-1 rounded-md font-medium", sortBy === "profit" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          >
            순수 수익순
          </button>
          <button
            onClick={() => setSortBy("score")}
            className={cn("px-2.5 py-1 rounded-md font-medium flex items-center gap-1", sortBy === "score" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          >
            <Award className="size-3" />
            가중점수순
          </button>
        </div>
        <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
          {(["mobile", "home", "upsell"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="size-2 rounded-sm" style={{ background: DEFAULT_CATEGORY_META[k].color }} />
              {DEFAULT_CATEGORY_META[k].label} ×{weights[k]}
            </span>
          ))}
        </div>
      </div>

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
                  {r.team} · {r.count}건 · 점수 {r.score.toFixed(1)}
                </div>
                <div className="mt-1.5 text-base font-bold text-gradient tabular-nums">{formatShortKRW(r.profit)}</div>
                <div className="mt-2"><StackBar row={r} /></div>
              </button>
            );
          })}
        </div>
      )}

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
                    "w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-lg transition-colors text-left",
                    r.isMe ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-white/[0.04]"
                  )}
                >
                  <div className="flex items-center justify-between">
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
                          {r.isMe && <span className="text-[9px] px-1 rounded bg-primary text-primary-foreground">나</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.team} · 모{r.cntCat.mobile}/홈{r.cntCat.home}/업{r.cntCat.upsell}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold tabular-nums">
                        {r.score.toFixed(1)}점
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatShortKRW(r.profit)}</span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                    </div>
                  </div>
                  <StackBar row={r} />
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
