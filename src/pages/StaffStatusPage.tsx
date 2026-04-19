import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { PeriodFilter } from "@/components/layout/PeriodFilter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, Users, TrendingUpIcon, Coins, Target, Sparkles, Info,
  Smartphone, Wifi, Gift, Calculator, CheckCircle2, Clock, XCircle, ChevronDown,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import { formatKRWShort } from "@/data/financeData";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { calcTotalIncentive, forecastIncentive, calcIncentiveForSale } from "@/lib/incentiveEngine";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Profile {
  user_id: string;
  display_name: string;
  team: string | null;
}

interface SaleRow {
  id: string;
  created_by: string;
  customer_name: string | null;
  device_model: string | null;
  product: string | null;
  channel: string | null;
  sale_type: string | null;
  open_date: string | null;
  manager: string | null;
  approval_status: string;
  pending_resolved: boolean;
  pending_items: any;
  distributor_amount: number | null;
  net_fee: number | null;
}

// Donut palette tuned for dark mode (gold + emerald accents)
const DONUT_COLORS = [
  "hsl(45 95% 60%)",   // gold
  "hsl(155 75% 55%)",  // emerald
  "hsl(195 90% 60%)",  // cyan
  "hsl(280 80% 70%)",  // violet
  "hsl(15 85% 65%)",   // coral
  "hsl(330 80% 65%)",  // pink
];

// Map a sale to a high-level revenue category for the donut
function categorize(sale: SaleRow): "모바일" | "결합/인터넷·TV" | "기타 오퍼" {
  const p = (sale.product ?? "").toLowerCase();
  if (/(인터넷|tv|결합|iot|기가)/i.test(sale.product ?? "")) return "결합/인터넷·TV";
  if (sale.device_model || /모바일|mobile/.test(p)) return "모바일";
  return "기타 오퍼";
}

const CATEGORY_ICON: Record<string, typeof Smartphone> = {
  모바일: Smartphone,
  "결합/인터넷·TV": Wifi,
  "기타 오퍼": Gift,
};

const STATUS_BADGE: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  확정: { label: "승인", className: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10", icon: CheckCircle2 },
  승인대기: { label: "대기", className: "border-amber-500/40 text-amber-300 bg-amber-500/10", icon: Clock },
  반려: { label: "반려", className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
  수정요청: { label: "수정요청", className: "border-orange-500/40 text-orange-300 bg-orange-500/10", icon: XCircle },
  환수: { label: "환수", className: "border-orange-500/40 text-orange-300 bg-orange-500/10", icon: XCircle },
  취소: { label: "취소", className: "border-destructive/40 text-destructive bg-destructive/10", icon: XCircle },
};

export default function StaffStatusPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { startDate, endDate, label } = usePeriod();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState<string>("__all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { rates: incentiveRates } = useIncentiveRates();
  const [showDetail, setShowDetail] = useState(false);

  // Simulator state
  const [simSaleType, setSimSaleType] = useState<string>("__any");
  const [simProduct, setSimProduct] = useState<string>("__any");
  const [simModel, setSimModel] = useState<string>("__any");

  const canViewAll = isAdmin || isManager;

  useEffect(() => {
    if (roleLoading || !user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, team").order("display_name");
      const list = (data ?? []) as Profile[];
      const visible = canViewAll ? list : list.filter((p) => p.user_id === user.id);
      setProfiles(visible);
      setSelectedId((prev) => prev ?? (canViewAll ? null : user.id));
    })();
  }, [user, canViewAll, roleLoading]);

  const teams = useMemo(() => {
    const s = new Set<string>();
    profiles.forEach((p) => p.team && s.add(p.team));
    return Array.from(s);
  }, [profiles]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (team !== "__all" && (p.team ?? "") !== team) return false;
      if (search && !p.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [profiles, search, team]);

  const selected = profiles.find((p) => p.user_id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) { setSales([]); return; }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, approval_status, pending_resolved, pending_items, distributor_amount, net_fee")
        .eq("created_by", selected.user_id)
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .order("open_date", { ascending: false });
      setSales((data ?? []) as SaleRow[]);
      setLoading(false);
    })();
  }, [selected, startDate, endDate]);

  // === Aggregated leaderboard for ALL visible staff ===
  const [allSales, setAllSales] = useState<SaleRow[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  useEffect(() => {
    if (roleLoading || profiles.length === 0) return;
    setAllLoading(true);
    (async () => {
      const ids = profiles.map((p) => p.user_id);
      const { data } = await supabase
        .from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, approval_status, pending_resolved, pending_items, distributor_amount, net_fee")
        .in("created_by", ids)
        .gte("open_date", startDate)
        .lte("open_date", endDate);
      setAllSales((data ?? []) as SaleRow[]);
      setAllLoading(false);
    })();
  }, [profiles, startDate, endDate, roleLoading]);

  const leaderboard = useMemo(() => {
    const byUser = new Map<string, SaleRow[]>();
    allSales.forEach((s) => {
      const arr = byUser.get(s.created_by) ?? [];
      arr.push(s);
      byUser.set(s.created_by, arr);
    });
    const rows = filteredProfiles.map((p) => {
      const list = byUser.get(p.user_id) ?? [];
      const { total } = calcTotalIncentive(list as any, incentiveRates);
      const distributorTotal = list.reduce((sum, s) => sum + Number(s.distributor_amount ?? 0), 0);
      const netFeeTotal = list.reduce((sum, s) => sum + Number(s.net_fee ?? 0), 0);
      const pendingCount = list.filter((s) => s.pending_resolved === false).length;
      return {
        profile: p,
        salesCount: list.length,
        incentive: total,
        distributorTotal,
        netFeeTotal,
        pendingCount,
      };
    });
    rows.sort((a, b) => b.incentive - a.incentive || b.salesCount - a.salesCount);
    return rows;
  }, [allSales, filteredProfiles, incentiveRates]);

  // === Incentive computation ===
  const incentive = useMemo(() => {
    const { total, breakdowns } = calcTotalIncentive(sales as any, incentiveRates);
    const fc = forecastIncentive(total, startDate, endDate);
    const goal = Math.max(fc.projected + 100000, Math.ceil((fc.projected || 100000) / 100000) * 100000 + 100000);
    const goalPct = goal > 0 ? Math.min(100, Math.round((total / goal) * 100)) : 0;
    const gapToGoal = Math.max(0, goal - total);
    const earnedSales = breakdowns.filter((b) => b.amount > 0).length;
    const avgPerSale = earnedSales > 0 ? Math.round(total / earnedSales) : 0;
    const salesNeeded = avgPerSale > 0 ? Math.ceil(gapToGoal / avgPerSale) : 0;

    // Per-sale items (joined with sales)
    const items = sales.map((s) => {
      const b = breakdowns.find((x) => x.saleId === s.id);
      return { sale: s, amount: b?.amount ?? 0, matched: b?.matched ?? [] };
    });

    // Category breakdown
    const catMap = new Map<string, number>();
    items.forEach((it) => {
      if (it.amount <= 0) return;
      const c = categorize(it.sale);
      catMap.set(c, (catMap.get(c) ?? 0) + it.amount);
    });
    const categoryData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

    return { total, fc, goal, goalPct, gapToGoal, salesNeeded, items, categoryData };
  }, [sales, incentiveRates, startDate, endDate]);

  // Simulator: estimate incentive for a hypothetical sale
  const distinctSaleTypes = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_sale_type).filter(Boolean) as string[])), [incentiveRates]);
  const distinctProducts = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_product).filter(Boolean) as string[])), [incentiveRates]);
  const distinctModels = useMemo(() => Array.from(new Set(incentiveRates.map((r) => r.match_model).filter(Boolean) as string[])), [incentiveRates]);

  const simResult = useMemo(() => {
    const hypo = {
      id: "__sim__",
      open_date: new Date().toISOString().slice(0, 10),
      sale_type: simSaleType === "__any" ? null : simSaleType,
      product: simProduct === "__any" ? null : simProduct,
      device_model: simModel === "__any" ? null : simModel,
    };
    return calcIncentiveForSale(hypo as any, incentiveRates);
  }, [simSaleType, simProduct, simModel, incentiveRates]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="size-6 text-primary-glow" /> 직원별 현황
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {canViewAll ? "직원을 선택해 개인 성과·인센티브 현황을 확인하세요" : "내 성과 및 인센티브 현황"} · {label}
            </p>
          </div>
          <PeriodFilter />
        </div>

        {/* Search & filter */}
        <Card className="p-4 glass">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="직원 이름 검색"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={!canViewAll}
              />
            </div>
            {canViewAll && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="팀" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">전체 팀</SelectItem>
                  {teams.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap gap-2 max-h-32 overflow-auto">
              {filteredProfiles.map((p) => (
                <button
                  key={p.user_id}
                  onClick={() => setSelectedId(p.user_id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    selectedId === p.user_id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/40 hover:border-primary/50 text-foreground/80"
                  }`}
                >
                  {p.display_name}
                  {p.team && <span className="ml-2 text-xs opacity-70">{p.team}</span>}
                </button>
              ))}
              {filteredProfiles.length === 0 && (
                <span className="text-sm text-muted-foreground">표시할 직원이 없습니다</span>
              )}
            </div>
          </div>
        </Card>

        {/* ============================================
            전직원 실적 한눈에 (Leaderboard)
            ============================================ */}
        {canViewAll && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-primary-glow" />
                전 직원 실적 한눈에
                <Badge variant="outline" className="border-border/50 text-muted-foreground ml-1">
                  {leaderboard.length}명
                </Badge>
              </h3>
              {allLoading && <span className="text-xs text-muted-foreground">불러오는 중…</span>}
            </div>
            {leaderboard.length === 0 ? (
              <Card className="glass p-8 text-center text-muted-foreground text-sm">
                해당 기간에 등록된 실적이 없습니다
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {leaderboard.map((row, idx) => {
                  const isSelected = selectedId === row.profile.user_id;
                  const rank = idx + 1;
                  return (
                    <button
                      key={row.profile.user_id}
                      onClick={() => setSelectedId(row.profile.user_id)}
                      className={`group text-left p-4 rounded-xl border glass transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
                        isSelected
                          ? "border-primary/60 bg-primary/[0.06]"
                          : "border-border/40 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`size-7 rounded-lg grid place-items-center text-[11px] font-bold shrink-0 ${
                            rank === 1 ? "bg-amber-500/20 text-amber-300" :
                            rank === 2 ? "bg-slate-400/20 text-slate-200" :
                            rank === 3 ? "bg-orange-500/20 text-orange-300" :
                            "bg-card/60 text-muted-foreground"
                          }`}>
                            #{rank}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{row.profile.display_name}</div>
                            {row.profile.team && (
                              <div className="text-[10px] text-muted-foreground truncate">{row.profile.team}</div>
                            )}
                          </div>
                        </div>
                        {row.pendingCount > 0 && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px] shrink-0">
                            미처리 {row.pendingCount}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-muted-foreground">개통 건수</div>
                          <div className="text-base font-bold tabular-nums">{row.salesCount}건</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">인센티브</div>
                          <div className="text-base font-bold text-amber-300 tabular-nums">
                            {formatKRWShort(row.incentive)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">유통망 지원금</div>
                          <div className="text-sm font-semibold tabular-nums text-foreground/90">
                            {formatKRWShort(row.distributorTotal)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground">회수 마진</div>
                          <div className="text-sm font-semibold text-emerald-300 tabular-nums">
                            {formatKRWShort(row.netFeeTotal)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!selected ? (
          <Card className="p-12 text-center glass">
            <Users className="size-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">위 카드에서 직원을 선택하면 상세 현황이 표시됩니다</p>
          </Card>
        ) : (
          <>
            {/* ============================================
                [1] 나의 성과 요약 카드 (3 hero cards)
                ============================================ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* 1. 이번 달 총 인센티브 */}
              <Card className="p-7 glass relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/[0.12] via-amber-500/[0.04] to-transparent">
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-amber-200/80">
                      <Coins className="size-4 text-amber-400" />
                      이번 달 총 인센티브
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition"><Info className="size-3.5" /></button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        어드민에 등록된 인센티브 규칙({incentiveRates.length}개)과 본인 실적을 매칭해 자동 합산한 금액입니다.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-tight text-amber-300 tabular-nums leading-none">
                    {formatKRWShort(incentive.total)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {incentive.items.filter((i) => i.amount > 0).length}건의 실적에서 발생
                  </p>
                </div>
              </Card>

              {/* 2. 마감 예상 인센티브 */}
              <Card className="p-7 glass relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.12] via-emerald-500/[0.04] to-transparent">
                <div className="absolute -right-10 -top-10 size-40 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-200/80">
                      <TrendingUpIcon className="size-4 text-emerald-400" />
                      마감 예상 인센티브
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground hover:text-foreground transition"><Info className="size-3.5" /></button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs text-xs">
                        현재까지 일평균 {formatKRWShort(Math.round(incentive.fc.dailyAvg))} × 총 {incentive.fc.totalDays}일로 선형 예측한 월말 예상 금액입니다.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="mt-4 text-4xl lg:text-5xl font-extrabold tracking-tight text-emerald-300 tabular-nums leading-none">
                    {formatKRWShort(incentive.fc.projected)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {incentive.fc.elapsedDays}/{incentive.fc.totalDays}일 경과 · 잔여 {incentive.fc.remainingDays}일
                  </p>
                </div>
              </Card>

              {/* 3. 목표 달성률 (circular gauge) */}
              <Card className="p-5 glass relative overflow-hidden border-amber-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Target className="size-4 text-amber-400" />
                    목표 달성률
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition"><Info className="size-3.5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      목표 = 마감 예상보다 한 단계 위(₩100,000 단위 올림). 페이스를 끌어올리면 목표가 자동 상향됩니다.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="relative h-44 mt-1">
                  <ResponsiveContainer>
                    <RadialBarChart
                      innerRadius="78%"
                      outerRadius="100%"
                      data={[{ name: "달성률", value: incentive.goalPct, fill: "hsl(45 95% 60%)" }]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={20} background={{ fill: "hsl(var(--muted) / 0.25)" }} />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-4xl font-extrabold text-amber-300 tabular-nums leading-none">{incentive.goalPct}%</div>
                    <div className="text-[10px] text-muted-foreground mt-1">목표 {formatKRWShort(incentive.goal)}</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex items-start gap-1.5">
                  <Sparkles className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {incentive.salesNeeded > 0
                      ? <>약 <span className="text-amber-300 font-bold">{incentive.salesNeeded}건</span> 더 판매하면 <span className="text-emerald-300 font-bold">{formatKRWShort(incentive.gapToGoal)}</span> 추가!</>
                      : "인센티브 단가를 등록하면 동기부여 메시지가 표시됩니다."}
                  </span>
                </p>
              </Card>
            </section>

            {/* ============================================
                [2] 항목별 수익 분석 + [4] 시뮬레이터
                ============================================ */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Donut */}
              <Card className="p-6 glass lg:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Smartphone className="size-4 text-primary-glow" />
                    항목별 인센티브 수익 비중
                  </h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition"><Info className="size-3.5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      모바일(단말기 개통), 결합/인터넷·TV, 기타 오퍼별로 인센티브 발생액을 합산한 비중입니다.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="h-64">
                    {incentive.categoryData.length === 0 ? (
                      <div className="h-full grid place-items-center text-sm text-muted-foreground">
                        매칭된 인센티브가 없습니다
                      </div>
                    ) : (
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={incentive.categoryData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={3} stroke="none">
                            {incentive.categoryData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                          </Pie>
                          <RTooltip
                            contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: any) => formatKRWShort(Number(v))}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {incentive.categoryData.length === 0 ? (
                      <li className="text-xs text-muted-foreground">아직 데이터가 없어요</li>
                    ) : incentive.categoryData.map((c, i) => {
                      const Icon = CATEGORY_ICON[c.name] ?? Gift;
                      const pct = incentive.total > 0 ? Math.round((c.value / incentive.total) * 100) : 0;
                      return (
                        <li key={c.name} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card/40 border border-border/40">
                          <div
                            className="size-9 rounded-lg grid place-items-center"
                            style={{ background: `${DONUT_COLORS[i % DONUT_COLORS.length]}22`, color: DONUT_COLORS[i % DONUT_COLORS.length] }}
                          >
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{c.name}</div>
                            <div className="text-[11px] text-muted-foreground">{pct}% 비중</div>
                          </div>
                          <div className="text-base font-bold text-amber-300 tabular-nums">{formatKRWShort(c.value)}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Card>

              {/* [4] Simulator */}
              <Card className="p-6 glass border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.06] to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Calculator className="size-4 text-emerald-400" />
                    인센티브 시뮬레이터
                  </h3>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="text-muted-foreground hover:text-foreground transition"><Info className="size-3.5" /></button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs text-xs">
                      조건을 골라 한 건 더 팔았을 때 받을 수 있는 인센티브를 미리 확인하세요.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="space-y-2.5">
                  <Select value={simSaleType} onValueChange={setSimSaleType}>
                    <SelectTrigger><SelectValue placeholder="가입 유형" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">가입 유형 — 무관</SelectItem>
                      {distinctSaleTypes.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={simProduct} onValueChange={setSimProduct}>
                    <SelectTrigger><SelectValue placeholder="상품" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">상품 — 무관</SelectItem>
                      {distinctProducts.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={simModel} onValueChange={setSimModel}>
                    <SelectTrigger><SelectValue placeholder="모델" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any">모델 — 무관</SelectItem>
                      {distinctModels.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08]">
                  <div className="text-[11px] text-emerald-200/80">+1건 추가 시 예상 인센티브</div>
                  <div className="text-3xl font-extrabold tabular-nums text-emerald-300 mt-0.5">
                    +{formatKRWShort(simResult.amount)}
                  </div>
                  {simResult.matched.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {simResult.matched.map((m) => (
                        <Badge key={m.rateId} variant="outline" className="border-emerald-500/30 text-emerald-300 text-[10px]">
                          {m.label} +{formatKRWShort(m.amount)}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[11px] text-muted-foreground">매칭되는 규칙이 없습니다</div>
                  )}
                </div>
                {simResult.amount > 0 && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    예상 합계: <span className="text-amber-300 font-semibold">{formatKRWShort(incentive.total + simResult.amount)}</span>
                    {" "}→ 달성률{" "}
                    <span className="text-amber-300 font-semibold">
                      {Math.min(100, Math.round(((incentive.total + simResult.amount) / Math.max(1, incentive.goal)) * 100))}%
                    </span>
                  </p>
                )}
              </Card>
            </section>

            {/* ============================================
                [3] 실시간 인센티브 카드 리스트
                ============================================ */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Coins className="size-4 text-amber-400" />
                  실시간 인센티브 발생 내역
                  <Badge variant="outline" className="border-border/50 text-muted-foreground ml-1">
                    {incentive.items.length}건
                  </Badge>
                </h3>
                {sales.length > 12 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowDetail((v) => !v)}>
                    {showDetail ? "접기" : `${sales.length - 12}건 더 보기`}
                    <ChevronDown className={`size-3.5 ml-1 transition-transform ${showDetail ? "rotate-180" : ""}`} />
                  </Button>
                )}
              </div>

              {loading ? (
                <Card className="glass p-10 text-center text-muted-foreground">불러오는 중…</Card>
              ) : incentive.items.length === 0 ? (
                <Card className="glass p-10 text-center text-muted-foreground">
                  해당 기간에 실적이 없습니다
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {(showDetail ? incentive.items : incentive.items.slice(0, 12)).map(({ sale, amount, matched }) => {
                    const status = STATUS_BADGE[sale.approval_status] ?? STATUS_BADGE["승인대기"];
                    const StatusIcon = status.icon;
                    const cat = categorize(sale);
                    const CatIcon = CATEGORY_ICON[cat] ?? Gift;
                    return (
                      <Card
                        key={sale.id}
                        className={`p-4 glass relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-elevated ${
                          amount > 0 ? "border-amber-500/20" : "border-border/40"
                        }`}
                      >
                        {amount > 0 && (
                          <div className="absolute -right-6 -top-6 size-20 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
                        )}
                        <div className="relative space-y-2.5">
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="size-8 rounded-lg bg-card/60 grid place-items-center text-muted-foreground shrink-0">
                                <CatIcon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold truncate">
                                  {sale.device_model || sale.product || "(모델 미지정)"}
                                </div>
                                <div className="text-[11px] text-muted-foreground truncate">
                                  {sale.customer_name ?? "고객 미상"} · {sale.open_date ?? "-"}
                                </div>
                              </div>
                            </div>
                            <Badge variant="outline" className={`gap-1 shrink-0 ${status.className}`}>
                              <StatusIcon className="size-3" /> {status.label}
                            </Badge>
                          </div>

                          {/* Body */}
                          <div className="flex items-end justify-between pt-1">
                            <div className="space-y-1">
                              <Badge variant="outline" className="border-border/40 text-muted-foreground text-[10px]">
                                {sale.sale_type ?? "유형 미지정"}
                              </Badge>
                              {sale.channel && (
                                <div className="text-[10px] text-muted-foreground">{sale.channel}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] text-muted-foreground">발생 인센티브</div>
                              <div className={`text-xl font-extrabold tabular-nums ${amount > 0 ? "text-amber-300" : "text-muted-foreground/70"}`}>
                                {amount > 0 ? `+${formatKRWShort(amount)}` : "₩0"}
                              </div>
                            </div>
                          </div>

                          {matched.length > 0 && (
                            <div className="pt-1 flex flex-wrap gap-1">
                              {matched.slice(0, 3).map((m) => (
                                <Badge key={m.rateId} variant="outline" className="border-amber-500/25 text-amber-200/80 text-[10px]">
                                  {m.label}
                                </Badge>
                              ))}
                              {matched.length > 3 && (
                                <span className="text-[10px] text-muted-foreground">+{matched.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
