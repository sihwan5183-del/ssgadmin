import { useState, useEffect, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Crown, Medal, Trophy, Star, TrendingUp, Flame, Zap,
  Award, BarChart3, Smartphone, Gift, ChevronDown,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ─── types ─── */
type ProfileMap = Record<string, { display_name: string; store: string | null }>;
type RankedUser = {
  user_id: string;
  name: string;
  store: string | null;
  count: number;
  profit: number;
  strategyCount: number;
  voucherReturned: number;
  streak: number;
  yesterdayDelta: number;
};
type ModelRank = { model: string; count: number; isStrategy: boolean };

/* ─── helpers ─── */
const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtKRW = (n: number) => {
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(1)}억`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(0)}만`;
  return fmt(n);
};

const TIERS = [
  { min: 0, label: "브론즈", color: "from-orange-700/40 to-orange-900/20 text-orange-300 border-orange-600/40", icon: "🥉" },
  { min: 10, label: "실버", color: "from-slate-400/30 to-slate-600/10 text-slate-200 border-slate-400/40", icon: "🥈" },
  { min: 25, label: "골드", color: "from-amber-400/30 to-amber-600/10 text-amber-300 border-amber-400/40", icon: "🥇" },
  { min: 50, label: "플래티넘", color: "from-cyan-400/30 to-cyan-600/10 text-cyan-200 border-cyan-400/40", icon: "💎" },
  { min: 100, label: "다이아몬드", color: "from-violet-400/40 to-violet-600/15 text-violet-200 border-violet-400/50", icon: "👑" },
];
const getTier = (count: number) => {
  for (let i = TIERS.length - 1; i >= 0; i--) if (count >= TIERS[i].min) return TIERS[i];
  return TIERS[0];
};
const nextTier = (count: number) => {
  const idx = TIERS.findIndex((t) => count < t.min);
  return idx >= 0 ? TIERS[idx] : null;
};

const PERIOD_OPTIONS = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
];

const dateRange = (period: string) => {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const toISO = (dt: Date) => dt.toISOString().slice(0, 10);
  if (period === "today") return { start: toISO(now), end: toISO(now) };
  if (period === "week") {
    const day = now.getDay();
    const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1));
    return { start: toISO(mon), end: toISO(now) };
  }
  return { start: `${y}-${String(m + 1).padStart(2, "0")}-01`, end: toISO(now) };
};
const yesterdayRange = () => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const s = y.toISOString().slice(0, 10);
  return { start: s, end: s };
};

/* ─── TABS ─── */
type TabKey = "sales" | "profit" | "strategy" | "voucher";
const TABS: { key: TabKey; label: string; icon: typeof Crown; sortFn: (a: RankedUser, b: RankedUser) => number }[] = [
  { key: "sales", label: "판매 왕", icon: Crown, sortFn: (a, b) => b.count - a.count },
  { key: "profit", label: "수익 왕", icon: TrendingUp, sortFn: (a, b) => b.profit - a.profit },
  { key: "strategy", label: "전략 모델 마스터", icon: Zap, sortFn: (a, b) => b.strategyCount - a.strategyCount },
  { key: "voucher", label: "상품권 킬러", icon: Gift, sortFn: (a, b) => b.voucherReturned - a.voucherReturned },
];

const PODIUM_STYLES = [
  { bg: "bg-gradient-to-br from-amber-400/30 to-orange-500/10 ring-amber-400/40", icon: Crown, color: "text-amber-300" },
  { bg: "bg-gradient-to-br from-slate-300/25 to-slate-500/5 ring-slate-300/40", icon: Trophy, color: "text-slate-200" },
  { bg: "bg-gradient-to-br from-orange-700/30 to-amber-800/10 ring-orange-600/40", icon: Medal, color: "text-orange-400" },
];

/* ─── Component ─── */
const RankingPage = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState("month");
  const [storeFilter, setStoreFilter] = useState("all");
  const [tab, setTab] = useState<TabKey>("sales");
  const [users, setUsers] = useState<RankedUser[]>([]);
  const [modelRanks, setModelRanks] = useState<ModelRank[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [stores, setStores] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { start, end } = dateRange(period);
    const yd = yesterdayRange();

    // Fetch profiles
    const { data: profs } = await supabase.from("profiles").select("user_id, display_name, store").eq("status", "active");
    const pMap: ProfileMap = {};
    const storeSet = new Set<string>();
    (profs ?? []).forEach((p) => {
      pMap[p.user_id] = { display_name: p.display_name, store: p.store };
      if (p.store) storeSet.add(p.store);
    });
    setProfiles(pMap);
    setStores(Array.from(storeSet).sort());

    // Fetch strategy model names
    const { data: stratModels } = await supabase.from("device_models").select("model_name").eq("is_strategy", true).eq("active", true);
    const stratSet = new Set((stratModels ?? []).map((m) => m.model_name));

    // Fetch sales in period
    const { data: sales } = await supabase
      .from("sales")
      .select("created_by, device_model, unit_price, distributor_amount, extra_subsidy, cash_support_amount, voucher, voucher_returned, open_date")
      .gte("open_date", start)
      .lte("open_date", end);

    // Yesterday sales for delta
    const { data: ySales } = await supabase
      .from("sales")
      .select("created_by")
      .gte("open_date", yd.start)
      .lte("open_date", yd.end);

    // Build per-user aggregates
    const uMap = new Map<string, { count: number; profit: number; strategyCount: number; voucherReturned: number; dateCounts: Map<string, number> }>();
    const mMap = new Map<string, { count: number; isStrategy: boolean }>();

    (sales ?? []).forEach((s) => {
      const uid = s.created_by;
      if (!uMap.has(uid)) uMap.set(uid, { count: 0, profit: 0, strategyCount: 0, voucherReturned: 0, dateCounts: new Map() });
      const u = uMap.get(uid)!;
      u.count++;
      const offer = (s.distributor_amount ?? 0) + (s.extra_subsidy ?? 0) + (s.cash_support_amount ?? 0);
      u.profit += (s.unit_price ?? 0) - offer;
      if (s.device_model && stratSet.has(s.device_model)) u.strategyCount++;
      if (s.voucher && s.voucher_returned === "유") u.voucherReturned++;
      if (s.open_date) u.dateCounts.set(s.open_date, (u.dateCounts.get(s.open_date) ?? 0) + 1);

      // Model ranking
      if (s.device_model) {
        if (!mMap.has(s.device_model)) mMap.set(s.device_model, { count: 0, isStrategy: stratSet.has(s.device_model) });
        mMap.get(s.device_model)!.count++;
      }
    });

    // Yesterday per-user counts
    const yMap = new Map<string, number>();
    (ySales ?? []).forEach((s) => yMap.set(s.created_by, (yMap.get(s.created_by) ?? 0) + 1));

    // Calculate streak (consecutive days with sales ending today)
    const calcStreak = (dateCounts: Map<string, number>) => {
      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        if (dateCounts.has(key)) streak++;
        else break;
      }
      return streak;
    };

    const ranked: RankedUser[] = [];
    uMap.forEach((v, uid) => {
      const p = pMap[uid];
      if (!p) return;
      ranked.push({
        user_id: uid,
        name: p.display_name,
        store: p.store,
        count: v.count,
        profit: v.profit,
        strategyCount: v.strategyCount,
        voucherReturned: v.voucherReturned,
        streak: calcStreak(v.dateCounts),
        yesterdayDelta: v.count - (yMap.get(uid) ?? 0),
      });
    });

    setUsers(ranked);
    setModelRanks(
      Array.from(mMap.entries())
        .map(([model, v]) => ({ model, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    );
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const activeTab = TABS.find((t) => t.key === tab)!;
  const sorted = useMemo(() => {
    let list = [...users];
    if (storeFilter !== "all") list = list.filter((u) => u.store === storeFilter);
    return list.sort(activeTab.sortFn);
  }, [users, storeFilter, activeTab]);

  const top10 = sorted.slice(0, 10);
  const podium = top10.slice(0, 3);
  const rest = top10.slice(3);

  // Rising star: highest yesterdayDelta
  const risingStar = useMemo(() => {
    const candidates = users.filter((u) => u.yesterdayDelta > 0);
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => b.yesterdayDelta - a.yesterdayDelta)[0];
  }, [users]);

  // My rank
  const myRank = useMemo(() => {
    if (!user) return null;
    const idx = sorted.findIndex((u) => u.user_id === user.id);
    if (idx < 0) return null;
    return { rank: idx + 1, data: sorted[idx] };
  }, [sorted, user]);

  const getValue = (u: RankedUser) => {
    switch (tab) {
      case "sales": return `${u.count}건`;
      case "profit": return `${fmtKRW(u.profit)}원`;
      case "strategy": return `${u.strategyCount}건`;
      case "voucher": return `${u.voucherReturned}건`;
    }
  };

  return (
    <>
      <Header title="판매 랭킹 센터" subtitle="전체 직원 및 매장별 실시간 판매 순위" showPeriodFilter={false} />

      {/* 내 순위 배너 */}
      {myRank && (
        <section className="glass rounded-2xl p-4 mb-4 shadow-card-elevated">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className={cn("size-10 rounded-full grid place-items-center text-lg font-bold ring-2",
                getTier(myRank.data.count).color.split(" ").slice(0, 2).join(" "),
                "ring-primary/30"
              )}>
                {getTier(myRank.data.count).icon}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  현재 전체 <span className="text-primary-glow">{myRank.rank}위</span>입니다!
                </p>
                <p className="text-xs text-muted-foreground">
                  {getTier(myRank.data.count).label} 등급 · {myRank.data.count}건 판매
                  {nextTier(myRank.data.count) && (
                    <> · 다음 등급({nextTier(myRank.data.count)!.label})까지 <span className="text-primary font-semibold">{nextTier(myRank.data.count)!.min - myRank.data.count}건</span> 남았습니다</>
                  )}
                </p>
              </div>
            </div>
            {myRank.data.streak >= 3 && (
              <Badge className="bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-300 border-orange-500/30 gap-1">
                <Flame className="size-3" /> {myRank.data.streak}일 연속 열일 중! 🔥
              </Badge>
            )}
          </div>
        </section>
      )}

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[120px] h-9 text-xs rounded-xl bg-input/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-[140px] h-9 text-xs rounded-xl bg-input/60">
            <SelectValue placeholder="전체 매장" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 매장</SelectItem>
            {stores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex p-1 rounded-xl bg-muted/60 text-xs mb-5 overflow-x-auto gap-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium transition-all whitespace-nowrap",
                tab === t.key ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* 라이징 스타 */}
      {risingStar && (
        <div className="glass rounded-2xl p-4 mb-5 shadow-card-elevated border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 grid place-items-center shadow-glow animate-pulse">
              <Star className="size-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-amber-400 font-semibold">⭐ 오늘의 라이징 스타</p>
              <p className="text-sm font-bold">
                {risingStar.name}
                {risingStar.store && <span className="text-xs text-muted-foreground font-normal ml-1.5">({risingStar.store})</span>}
                <span className="text-xs text-primary-glow ml-2">어제 대비 +{risingStar.yesterdayDelta}건 급증! 🚀</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 리더보드 (2/3) */}
        <div className="lg:col-span-2 glass rounded-2xl p-5 shadow-card-elevated">
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <activeTab.icon className="size-4 text-primary" /> TOP 10 — {activeTab.label}
          </h3>

          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">로딩 중...</div>
          ) : top10.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">데이터가 없습니다</div>
          ) : (
            <>
              {/* Podium */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                {podium.map((u, i) => {
                  const S = PODIUM_STYLES[i];
                  const Icon = S.icon;
                  const tier = getTier(u.count);
                  return (
                    <div key={u.user_id} className={cn("rounded-xl p-3 ring-1 backdrop-blur-md relative overflow-hidden", S.bg)}>
                      <div className="flex items-center justify-between">
                        <Icon className={cn("size-5", S.color)} />
                        <span className={cn("text-xs font-bold", S.color)}>#{i + 1}</span>
                      </div>
                      <div className="mt-2">
                        <div className="text-sm font-bold truncate">{u.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{u.store ?? "미배정"}</div>
                      </div>
                      <div className="mt-2 text-lg font-bold text-gradient">{getValue(u)}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px]">{tier.icon}</span>
                        <span className="text-[10px] text-muted-foreground">{tier.label}</span>
                      </div>
                      {u.streak >= 3 && (
                        <Badge className="absolute top-2 right-2 text-[9px] bg-orange-500/20 text-orange-300 border-orange-500/30 px-1 py-0">
                          <Flame className="size-2.5" /> {u.streak}일
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 4~10위 리스트 */}
              <ul className="space-y-1">
                {rest.map((u, i) => {
                  const tier = getTier(u.count);
                  const isMe = u.user_id === user?.id;
                  return (
                    <li key={u.user_id} className={cn(
                      "flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors",
                      isMe ? "bg-primary/[0.08] ring-1 ring-primary/20" : "hover:bg-muted/30"
                    )}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums w-6 text-center">{i + 4}</span>
                        <span className="text-[10px]">{tier.icon}</span>
                        <span className="text-sm font-medium">{u.name}</span>
                        {u.store && <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/60">{u.store}</span>}
                        {u.streak >= 3 && (
                          <span className="text-[10px] text-orange-400 flex items-center gap-0.5"><Flame className="size-2.5" />{u.streak}일</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold tabular-nums">{getValue(u)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* 사이드 패널 (1/3) */}
        <div className="space-y-5">
          {/* 모델별 판매량 TOP 5 */}
          <div className="glass rounded-2xl p-5 shadow-card-elevated">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Smartphone className="size-4 text-primary" /> 모델별 판매량 TOP 5
            </h4>
            {modelRanks.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">데이터 없음</p>
            ) : (
              <ul className="space-y-2">
                {modelRanks.map((m, i) => {
                  const maxCount = modelRanks[0]?.count ?? 1;
                  const pct = Math.round((m.count / maxCount) * 100);
                  return (
                    <li key={m.model} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium flex items-center gap-1.5">
                          <span className="text-muted-foreground tabular-nums w-4">{i + 1}.</span>
                          {m.model}
                          {m.isStrategy && (
                            <Badge className="text-[8px] px-1 py-0 bg-primary/20 text-primary border-primary/30">전략</Badge>
                          )}
                        </span>
                        <span className="tabular-nums font-semibold">{m.count}건</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            m.isStrategy
                              ? "bg-gradient-to-r from-primary to-primary-glow shadow-[0_0_8px_hsl(330_100%_55%/0.5)]"
                              : "bg-muted-foreground/40"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 등급 안내 */}
          <div className="glass rounded-2xl p-5 shadow-card-elevated">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award className="size-4 text-primary" /> 등급 시스템
            </h4>
            <ul className="space-y-2">
              {TIERS.map((t) => (
                <li key={t.label} className={cn("flex items-center justify-between px-3 py-2 rounded-lg ring-1 bg-gradient-to-br", t.color)}>
                  <span className="flex items-center gap-2 text-xs font-medium">
                    <span>{t.icon}</span> {t.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{t.min}건 이상</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default RankingPage;
