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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, FileWarning, AlertTriangle, TrendingUp, Wallet, Activity, Coins, Target, TrendingUpIcon, Sparkles } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatKRWShort } from "@/data/financeData";
import { useIncentiveRates } from "@/hooks/useIncentiveRates";
import { calcTotalIncentive, forecastIncentive } from "@/lib/incentiveEngine";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

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

const PIE_COLORS = ["hsl(var(--primary))", "hsl(280 90% 65%)", "hsl(190 90% 55%)", "hsl(150 70% 55%)", "hsl(40 90% 60%)", "hsl(0 80% 65%)", "hsl(320 80% 65%)"];

export default function StaffStatusPage() {
  const { user } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { startDate, endDate, label } = usePeriod();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState<string>("__all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const { rates: incentiveRates } = useIncentiveRates();
  const [showIncentiveDetail, setShowIncentiveDetail] = useState(false);

  const canViewAll = isAdmin || isManager;

  // Load profiles (admin: all; user: self only)
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

  // Load sales for selected staff in period
  useEffect(() => {
    if (!selected) {
      setSales([]);
      setDocCounts({});
      return;
    }
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("sales")
        .select("id, created_by, customer_name, device_model, product, channel, sale_type, open_date, manager, approval_status, pending_resolved, pending_items, distributor_amount, net_fee")
        .eq("created_by", selected.user_id)
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .order("open_date", { ascending: false });
      const rows = (data ?? []) as SaleRow[];
      setSales(rows);

      // Doc counts
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const { data: docs } = await supabase.from("sale_documents").select("sale_id").in("sale_id", ids);
        const counts: Record<string, number> = {};
        (docs ?? []).forEach((d: any) => {
          counts[d.sale_id] = (counts[d.sale_id] ?? 0) + 1;
        });
        setDocCounts(counts);
      } else {
        setDocCounts({});
      }
      setLoading(false);
    })();
  }, [selected, startDate, endDate]);

  const stats = useMemo(() => {
    const total = sales.length;
    const distributorSum = sales.reduce((s, r) => s + (Number(r.distributor_amount) || 0), 0);
    const netFeeSum = sales.reduce((s, r) => s + (Number(r.net_fee) || 0), 0);
    const pendingCount = sales.filter((r) => !r.pending_resolved).length;
    const missingDocs = sales.filter((r) => (docCounts[r.id] ?? 0) === 0).length;

    const modelMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    sales.forEach((r) => {
      const m = r.device_model || "미지정";
      modelMap.set(m, (modelMap.get(m) ?? 0) + 1);
      const t = r.sale_type || "미지정";
      typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
    });
    const topModels = Array.from(modelMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
    const otherCount = Array.from(modelMap.entries()).slice(6).reduce((s, [, v]) => s + v, 0);
    if (otherCount > 0) topModels.push({ name: "기타", value: otherCount });
    const typeMix = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));

    return { total, distributorSum, netFeeSum, pendingCount, missingDocs, topModels, typeMix };
  }, [sales, docCounts]);

  // === Incentive computation ===
  const incentive = useMemo(() => {
    const { total, breakdowns } = calcTotalIncentive(sales as any, incentiveRates);
    const fc = forecastIncentive(total, startDate, endDate);
    const detail = breakdowns
      .map((b) => {
        const sale = sales.find((s) => s.id === b.saleId);
        return { ...b, sale };
      })
      .filter((d) => d.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    // Goal heuristic: round projected up to next 100k as motivational target
    const goal = Math.max(fc.projected + 100000, Math.ceil((fc.projected || 100000) / 100000) * 100000 + 100000);
    const gapToGoal = Math.max(0, goal - total);
    const avgPerSale = sales.length > 0 ? Math.round(total / Math.max(1, sales.filter((_, i) => breakdowns[i]?.amount > 0).length || 1)) : 0;
    const salesNeeded = avgPerSale > 0 ? Math.ceil(gapToGoal / avgPerSale) : 0;
    return { total, fc, detail, goal, gapToGoal, salesNeeded };
  }, [sales, incentiveRates, startDate, endDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-primary-glow" /> 직원별 현황
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {canViewAll ? "전체 직원의 성과 및 업무 완결도를 확인하세요" : "본인의 성과 및 업무 완결도"} · {label}
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

      {!selected ? (
        <Card className="p-12 text-center glass">
          <Users className="size-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">상단에서 직원을 선택하세요</p>
        </Card>
      ) : (
        <>
          {/* === Incentive cards (gold/emerald accent) === */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 glass relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-amber-500/10 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between text-sm text-muted-foreground relative">
                <span className="font-medium">당월 확정 인센티브</span>
                <Coins className="size-4 text-amber-400" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-amber-400 relative">
                {formatKRWShort(incentive.total)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 relative">
                현재까지 매칭된 단가 합산 · {incentiveRates.length}개 규칙 적용 중
              </p>
            </Card>

            <Card className="p-5 glass relative overflow-hidden border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent">
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
              <div className="flex items-center justify-between text-sm text-muted-foreground relative">
                <span className="font-medium">마감 예상 인센티브</span>
                <TrendingUpIcon className="size-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight text-emerald-400 relative">
                {formatKRWShort(incentive.fc.projected)}
              </div>
              <div className="mt-3 relative">
                <Progress
                  value={Math.min(100, incentive.fc.projected > 0 ? (incentive.total / incentive.fc.projected) * 100 : 0)}
                  className="h-1.5"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {incentive.fc.elapsedDays}/{incentive.fc.totalDays}일 경과 · 일평균 {formatKRWShort(Math.round(incentive.fc.dailyAvg))}
                </p>
              </div>
            </Card>

            <Card className="p-5 glass relative overflow-hidden border-amber-500/30">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="font-medium">목표까지</span>
                <Target className="size-4 text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight">
                <span className="text-amber-400">{formatKRWShort(incentive.gapToGoal)}</span>
                <span className="text-sm text-muted-foreground ml-1">남음</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex items-start gap-1.5">
                <Sparkles className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  {incentive.salesNeeded > 0
                    ? <>약 <span className="text-amber-400 font-bold">{incentive.salesNeeded}건</span> 더 판매하면 <span className="text-emerald-400 font-bold">{formatKRWShort(incentive.gapToGoal)}</span> 인센티브가 추가돼요!</>
                    : "인센티브 단가를 등록하면 동기부여 메시지가 표시됩니다."}
                </span>
              </p>
            </Card>
          </div>

          {/* Incentive detail (collapsible, transparency) */}
          <Collapsible open={showIncentiveDetail} onOpenChange={setShowIncentiveDetail}>
            <Card className="glass">
              <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors rounded-t-lg">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-amber-400" />
                  <span className="text-sm font-semibold">인센티브 상세 내역</span>
                  <Badge variant="outline" className="border-amber-500/40 text-amber-400 ml-2">
                    {incentive.detail.length}건
                  </Badge>
                </div>
                <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showIncentiveDetail ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="overflow-x-auto border-t border-border/40">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>개통일</TableHead>
                        <TableHead>고객</TableHead>
                        <TableHead>모델</TableHead>
                        <TableHead>유형</TableHead>
                        <TableHead>적용 규칙</TableHead>
                        <TableHead className="text-right">인센티브</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incentive.detail.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">매칭된 인센티브가 없습니다. 어드민에서 단가를 먼저 등록해주세요.</TableCell></TableRow>
                      ) : incentive.detail.map((d) => (
                        <TableRow key={d.saleId}>
                          <TableCell className="text-xs">{d.sale?.open_date ?? "-"}</TableCell>
                          <TableCell className="text-xs">{d.sale?.customer_name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{d.sale?.device_model ?? "-"}</TableCell>
                          <TableCell className="text-xs">{d.sale?.sale_type ?? "-"}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {d.matched.map((m) => (
                                <Badge key={m.rateId} variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                                  {m.label} +{formatKRWShort(m.amount)}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-amber-400 tabular-nums">
                            {formatKRWShort(d.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 glass">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>당월 개통 건수</span>
                <Activity className="size-4 text-primary-glow" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight">{stats.total.toLocaleString("ko-KR")}건</div>
            </Card>
            <Card className="p-5 glass">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>유통망 지원금 총액</span>
                <Wallet className="size-4 text-orange-400" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight">{formatKRWShort(stats.distributorSum)}</div>
            </Card>
            <Card className="p-5 glass">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>회수 마진 (수익) 총액</span>
                <TrendingUp className="size-4 text-emerald-400" />
              </div>
              <div className="mt-2 text-3xl font-bold tracking-tight">{formatKRWShort(stats.netFeeSum)}</div>
            </Card>
          </div>

          {/* Completion alerts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 glass border-l-4 border-l-destructive">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4 text-destructive" />
                  미처리 (결합/할부 등)
                </div>
                <span className="text-xs text-muted-foreground">독려 필요</span>
              </div>
              <div className="mt-2 text-4xl font-bold text-destructive">{stats.pendingCount.toLocaleString("ko-KR")}건</div>
            </Card>
            <Card className="p-5 glass border-l-4 border-l-destructive">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileWarning className="size-4 text-destructive" />
                  서류 미첨부
                </div>
                <span className="text-xs text-muted-foreground">독려 필요</span>
              </div>
              <div className="mt-2 text-4xl font-bold text-destructive">{stats.missingDocs.toLocaleString("ko-KR")}건</div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 glass">
              <h3 className="text-sm font-semibold mb-3">판매 모델 믹스</h3>
              <div className="h-64">
                {stats.topModels.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">데이터 없음</div>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.topModels} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {stats.topModels.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
            <Card className="p-5 glass">
              <h3 className="text-sm font-semibold mb-3">유형 비중 (MNP / 기변 / 신규)</h3>
              <div className="h-64">
                {stats.typeMix.length === 0 ? (
                  <div className="h-full grid place-items-center text-sm text-muted-foreground">데이터 없음</div>
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={stats.typeMix} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                        {stats.typeMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* Recent sales */}
          <Card className="glass">
            <div className="p-5 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{selected.display_name} · 최근 실적</h3>
              <span className="text-xs text-muted-foreground">{sales.length}건</span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>개통일</TableHead>
                    <TableHead>고객</TableHead>
                    <TableHead>모델</TableHead>
                    <TableHead>채널</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>검수 상태</TableHead>
                    <TableHead>미처리</TableHead>
                    <TableHead>서류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">불러오는 중…</TableCell></TableRow>
                  ) : sales.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">실적이 없습니다</TableCell></TableRow>
                  ) : (
                    sales.slice(0, 50).map((r) => {
                      const docs = docCounts[r.id] ?? 0;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{r.open_date ?? "-"}</TableCell>
                          <TableCell>{r.customer_name ?? "-"}</TableCell>
                          <TableCell className="text-xs">{r.device_model ?? "-"}</TableCell>
                          <TableCell className="text-xs">{r.channel ?? "-"}</TableCell>
                          <TableCell className="text-xs">{r.sale_type ?? "-"}</TableCell>
                          <TableCell>
                            <Badge variant={r.approval_status === "확정" ? "default" : "outline"}>
                              {r.approval_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.pending_resolved ? (
                              <span className="text-xs text-muted-foreground">완료</span>
                            ) : (
                              <Badge variant="destructive">미처리</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {docs === 0 ? (
                              <Badge variant="destructive">미첨부</Badge>
                            ) : (
                              <span className="text-xs text-emerald-400">{docs}건</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
