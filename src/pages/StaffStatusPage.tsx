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
