import { useMemo, useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Pie, PieChart, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Crown, Medal, TrendingUp, XCircle, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Inquiry } from "@/hooks/useInquiries";

const FAIL_REASONS = ["가격(지원금) 불만", "결합/위약금 문제", "기기 재고 없음", "타사 유지", "단순 변심", "연락 두절", "기타"] as const;
export { FAIL_REASONS };

const FAIL_COLORS = ["hsl(0 70% 55%)", "hsl(25 80% 55%)", "hsl(45 90% 50%)", "hsl(200 70% 55%)", "hsl(270 60% 55%)", "hsl(320 60% 55%)", "hsl(var(--muted-foreground))"];

interface Props {
  rows: Inquiry[];
}

const COLORS = ["hsl(270 90% 65%)", "hsl(320 90% 65%)", "hsl(200 90% 60%)", "hsl(40 95% 60%)", "hsl(150 70% 55%)", "hsl(0 80% 65%)", "hsl(180 70% 55%)"];

const STATUS_COLORS: Record<string, string> = {
  "성공(개통)": "hsl(152 76% 50%)",
  "실패(종결)": "hsl(0 70% 55%)",
  "재케어(예약)": "hsl(200 80% 55%)",
  "부재": "hsl(35 90% 55%)",
  "미처리": "hsl(var(--muted-foreground))",
};

export const InquiryDashboard = ({ rows }: Props) => {
  const [managerFilter, setManagerFilter] = useState<string>("전체");

  // 채널별 인입/전환
  const byChannel = useMemo(() => {
    const map = new Map<string, { channel: string; total: number; converted: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.channel) ?? { channel: r.channel, total: 0, converted: 0 };
      cur.total += 1;
      if (r.status === "성공(개통)") cur.converted += 1;
      map.set(r.channel, cur);
    });
    return Array.from(map.values())
      .map((c) => ({ ...c, rate: c.total > 0 ? Math.round((c.converted / c.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // 일별 인입 추이
  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; 인입: number; 개통: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.inquiry_date) ?? { day: r.inquiry_date.slice(5), 인입: 0, 개통: 0 };
      cur.인입 += 1;
      if (r.status === "성공(개통)") cur.개통 += 1;
      map.set(r.inquiry_date, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [rows]);

  const totals = useMemo(() => {
    const total = rows.length;
    const converted = rows.filter((r) => r.status === "성공(개통)").length;
    const pending = rows.filter((r) => r.status === "미처리").length;
    const absent = rows.filter((r) => r.status === "부재").length;
    const recare = rows.filter((r) => r.status === "재케어(예약)").length;
    const failed = rows.filter((r) => r.status === "실패(종결)").length;
    return { total, converted, pending, absent, recare, failed, rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
  }, [rows]);

  // 담당자 목록
  const managers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => { if (r.manager) set.add(r.manager); });
    return Array.from(set).sort();
  }, [rows]);

  // 담당자별 필터링된 rows
  const filteredRows = useMemo(() => {
    if (managerFilter === "전체") return rows;
    return rows.filter((r) => r.manager === managerFilter);
  }, [rows, managerFilter]);

  // 상태별 파이차트 데이터
  const statusPieData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach((r) => {
      map.set(r.status, (map.get(r.status) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value, fill: STATUS_COLORS[name] ?? "hsl(var(--muted))" }));
  }, [filteredRows]);

  // 담당자별 랭킹 (전환율 순)
  const managerRanking = useMemo(() => {
    const map = new Map<string, { manager: string; total: number; success: number; failed: number; absent: number; recare: number }>();
    rows.forEach((r) => {
      const mgr = r.manager || "미배정";
      const cur = map.get(mgr) ?? { manager: mgr, total: 0, success: 0, failed: 0, absent: 0, recare: 0 };
      cur.total += 1;
      if (r.status === "성공(개통)") cur.success += 1;
      else if (r.status === "실패(종결)") cur.failed += 1;
      else if (r.status === "부재") cur.absent += 1;
      else if (r.status === "재케어(예약)") cur.recare += 1;
      map.set(mgr, cur);
    });
    return Array.from(map.values())
      .map((m) => ({ ...m, rate: m.total > 0 ? Math.round((m.success / m.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate || b.success - a.success);
  }, [rows]);

  // 라이징 스타 (전일 대비 성공 증가 상위)
  const risingStars = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const map = new Map<string, { today: number; yesterday: number }>();
    rows.forEach((r) => {
      if (r.status !== "성공(개통)") return;
      const mgr = r.manager || "미배정";
      const cur = map.get(mgr) ?? { today: 0, yesterday: 0 };
      if (r.inquiry_date === today) cur.today += 1;
      if (r.inquiry_date === yesterday) cur.yesterday += 1;
      map.set(mgr, cur);
    });
    return Array.from(map.entries())
      .map(([manager, v]) => ({ manager, diff: v.today - v.yesterday, today: v.today }))
      .filter((r) => r.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 5);
  }, [rows]);

  // 실패 사유 TOP 분석
  const failReasonData = useMemo(() => {
    const map = new Map<string, number>();
    filteredRows.forEach((r) => {
      if (r.status === "실패(종결)" && (r as any).fail_reason) {
        const reason = (r as any).fail_reason as string;
        map.set(reason, (map.get(reason) ?? 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([reason, count], i) => ({ reason, count, fill: FAIL_COLORS[i % FAIL_COLORS.length] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredRows]);

  // 채널별 효율 비교 (성공률 순)
  const channelEfficiency = useMemo(() => {
    const map = new Map<string, { channel: string; total: number; success: number; failed: number }>();
    rows.forEach((r) => {
      const ch = r.channel || "기타";
      const cur = map.get(ch) ?? { channel: ch, total: 0, success: 0, failed: 0 };
      cur.total += 1;
      if (r.status === "성공(개통)") cur.success += 1;
      if (r.status === "실패(종결)") cur.failed += 1;
      map.set(ch, cur);
    });
    return Array.from(map.values())
      .map((c) => ({ ...c, rate: c.total > 0 ? Math.round((c.success / c.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [rows]);

  // 개인 상세 보기
  const [detailManager, setDetailManager] = useState<string | null>(null);
  const [detailLogs, setDetailLogs] = useState<any[]>([]);

  const detailRows = useMemo(() => {
    if (!detailManager) return [];
    return rows.filter((r) => r.manager === detailManager).sort((a, b) => b.inquiry_date.localeCompare(a.inquiry_date));
  }, [rows, detailManager]);

  useEffect(() => {
    if (!detailManager || detailRows.length === 0) { setDetailLogs([]); return; }
    const ids = detailRows.slice(0, 50).map((r) => r.id);
    supabase.from("inquiry_logs").select("*").in("inquiry_id", ids).order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setDetailLogs(data ?? []));
  }, [detailManager, detailRows]);
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* 담당자 필터 */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={managerFilter === "전체" ? "default" : "outline"} className="cursor-pointer" onClick={() => setManagerFilter("전체")}>전체</Badge>
        {managers.map((m) => (
          <Badge key={m} variant={managerFilter === m ? "default" : "outline"} className="cursor-pointer" onClick={() => setManagerFilter(m)}>{m}</Badge>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">총 인입</div><div className="text-2xl font-semibold mt-1">{totals.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">미처리</div><div className="text-2xl font-semibold mt-1">{totals.pending}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">부재</div><div className="text-2xl font-semibold mt-1 text-amber-500">{totals.absent}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">재케어</div><div className="text-2xl font-semibold mt-1 text-blue-400">{totals.recare}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">성공(개통)</div><div className="text-2xl font-semibold mt-1 text-primary">{totals.converted}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">전환율</div><div className="text-2xl font-semibold mt-1">{totals.rate}%</div></Card>
      </div>

      <Tabs defaultValue="channel" className="space-y-3">
        <TabsList>
          <TabsTrigger value="channel">채널별 분석</TabsTrigger>
          <TabsTrigger value="status">상태 비중</TabsTrigger>
          <TabsTrigger value="ranking">전환율 랭킹</TabsTrigger>
          <TabsTrigger value="failReason">실패 사유</TabsTrigger>
          <TabsTrigger value="efficiency">채널 효율</TabsTrigger>
        </TabsList>

        <TabsContent value="channel" className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">채널별 인입 & 전환율</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string, p: any) => {
                    if (n === "total") return [`${v}건 (전환 ${p.payload.converted}건 · ${p.payload.rate}%)`, "인입"];
                    return [v, n];
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {byChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {byChannel.length > 0 && (
            <div className="mt-3 space-y-1">
              {byChannel.map((c, i) => (
                <div key={c.channel} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.channel}
                  </span>
                  <span className="text-muted-foreground">{c.total}건 → {c.converted}건 · <span className="text-foreground font-medium">{c.rate}%</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">일별 인입 추이</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="인입" stroke="hsl(270 90% 70%)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="개통" stroke="hsl(152 76% 50%)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
        </TabsContent>

        {/* 상태 비중 파이차트 */}
        <TabsContent value="status">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">
                상태 비중 {managerFilter !== "전체" && <span className="text-muted-foreground font-normal">— {managerFilter}</span>}
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={40} strokeWidth={2} stroke="hsl(var(--background))">
                      {statusPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 space-y-1">
                {statusPieData.map((d) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: d.fill }} />
                      {d.name}
                    </span>
                    <span className="text-muted-foreground">{d.value}건 · {filteredRows.length > 0 ? Math.round((d.value / filteredRows.length) * 100) : 0}%</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 주의 필요 직원 */}
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" /> 주의 필요 담당자
              </div>
              <p className="text-xs text-muted-foreground mb-3">부재·재케어 비중 50% 이상인 담당자</p>
              <div className="space-y-2">
                {managerRanking
                  .filter((m) => m.total >= 3 && ((m.absent + m.recare) / m.total) >= 0.5)
                  .map((m) => {
                    const pct = Math.round(((m.absent + m.recare) / m.total) * 100);
                    return (
                      <div key={m.manager} className="flex items-center justify-between p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-sm font-medium">{m.manager}</span>
                        <div className="text-xs text-muted-foreground">
                          부재 {m.absent} + 재케어 {m.recare} = <span className="text-amber-500 font-semibold">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                {managerRanking.filter((m) => m.total >= 3 && ((m.absent + m.recare) / m.total) >= 0.5).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6">해당 없음 👍</div>
                )}
              </div>

              {/* 라이징 스타 */}
              {risingStars.length > 0 && (
                <div className="mt-6">
                  <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <TrendingUp className="size-4 text-emerald-400" /> 오늘의 라이징 스타
                  </div>
                  <div className="space-y-1.5">
                    {risingStars.map((r) => (
                      <div key={r.manager} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="font-medium">{r.manager}</span>
                        <span className="text-emerald-400">오늘 {r.today}건 (+{r.diff}↑)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* 전환율 랭킹 */}
        <TabsContent value="ranking">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">기획팀 전환율 랭킹</div>
            <div className="space-y-2">
              {managerRanking.map((m, i) => {
                const rank = i + 1;
                const RankIcon = rank === 1 ? Crown : rank <= 3 ? Medal : null;
                const rankColor = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "";
                return (
                  <div key={m.manager} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className={`text-lg font-bold tabular-nums w-8 text-center ${rankColor}`}>
                      {RankIcon ? <RankIcon className="size-5 mx-auto" /> : rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <button className="font-medium text-sm hover:text-primary hover:underline text-left" onClick={() => setDetailManager(m.manager)}>{m.manager}</button>
                        {rank <= 3 && <Badge variant="default" className="text-[10px] h-4">TOP {rank}</Badge>}
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                        <span>인입 {m.total}</span>
                        <span>성공 {m.success}</span>
                        <span>실패 {m.failed}</span>
                        <span>부재 {m.absent}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold tabular-nums text-primary">{m.rate}%</div>
                      <div className="text-[10px] text-muted-foreground">전환율</div>
                    </div>
                    {/* 전환율 바 */}
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden hidden md:block">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${m.rate}%` }} />
                    </div>
                  </div>
                );
              })}
              {managerRanking.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-8">데이터 없음</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* 실패 사유 TOP 5 */}
        <TabsContent value="failReason">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <XCircle className="size-4 text-destructive" /> 실패 사유 TOP 5
              </div>
              {failReasonData.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">실패 사유 데이터 없음</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={failReasonData} layout="vertical" margin={{ left: 100, right: 10, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="reason" fontSize={11} tickLine={false} axisLine={false} width={95} />
                      <Tooltip contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" name="건수" radius={[0, 6, 6, 0]}>
                        {failReasonData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
            <Card className="p-4">
              <div className="text-sm font-semibold mb-3">실패 사유 상세</div>
              <div className="space-y-2">
                {failReasonData.map((d) => {
                  const totalFailed = filteredRows.filter((r) => r.status === "실패(종결)").length;
                  const pct = totalFailed > 0 ? Math.round((d.count / totalFailed) * 100) : 0;
                  return (
                    <div key={d.reason} className="flex items-center gap-3">
                      <span className="size-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                      <span className="text-sm flex-1">{d.reason}</span>
                      <span className="text-xs text-muted-foreground">{d.count}건</span>
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.fill }} />
                      </div>
                      <span className="text-xs font-medium w-10 text-right">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* 채널 효율 비교 */}
        <TabsContent value="efficiency">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">인입 경로별 전환 효율</div>
            {channelEfficiency.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">데이터 없음</div>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelEfficiency} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <Tooltip contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="success" name="성공" fill="hsl(152 76% 50%)" stackId="a" />
                      <Bar dataKey="failed" name="실패" fill="hsl(0 70% 55%)" stackId="a" radius={[4, 4, 0, 0]} />
                      <Legend />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {channelEfficiency.map((c, i) => (
                    <div key={c.channel} className="flex items-center gap-3 text-xs">
                      <span className="font-medium w-20 truncate">{c.channel}</span>
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${c.rate}%` }} />
                      </div>
                      <span className="tabular-nums w-24 text-right text-muted-foreground">
                        {c.success}/{c.total}건 · <span className="text-foreground font-semibold">{c.rate}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* 개인 상세 리포트 Dialog */}
      <Dialog open={!!detailManager} onOpenChange={(v) => !v && setDetailManager(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-4" /> {detailManager} — 상세 리포트
            </DialogTitle>
          </DialogHeader>
          {detailManager && (
            <div className="space-y-4">
              {/* 요약 */}
              {(() => {
                const total = detailRows.length;
                const success = detailRows.filter((r) => r.status === "성공(개통)").length;
                const failed = detailRows.filter((r) => r.status === "실패(종결)").length;
                const absent = detailRows.filter((r) => r.status === "부재").length;
                const rate = total > 0 ? Math.round((success / total) * 100) : 0;
                return (
                  <div className="grid grid-cols-4 gap-2">
                    <Card className="p-2 text-center"><div className="text-[10px] text-muted-foreground">총 인입</div><div className="text-lg font-bold">{total}</div></Card>
                    <Card className="p-2 text-center"><div className="text-[10px] text-muted-foreground">성공</div><div className="text-lg font-bold text-primary">{success}</div></Card>
                    <Card className="p-2 text-center"><div className="text-[10px] text-muted-foreground">실패</div><div className="text-lg font-bold text-destructive">{failed}</div></Card>
                    <Card className="p-2 text-center"><div className="text-[10px] text-muted-foreground">전환율</div><div className="text-lg font-bold">{rate}%</div></Card>
                  </div>
                );
              })()}

              {/* 타임라인 */}
              <div className="text-sm font-semibold">처리 타임라인</div>
              <div className="space-y-0">
                {detailRows.slice(0, 30).map((r, i) => {
                  const inquiryLogs = detailLogs.filter((l) => l.inquiry_id === r.id);
                  return (
                    <div key={r.id} className="flex gap-3 py-3 border-b border-border/30 last:border-0">
                      <div className="flex flex-col items-center">
                        <div className="size-2.5 rounded-full mt-1" style={{ background: STATUS_COLORS[r.status] ?? "hsl(var(--muted))" }} />
                        {i < Math.min(detailRows.length, 30) - 1 && <div className="w-px flex-1 bg-border/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs tabular-nums text-muted-foreground">{r.inquiry_date}</span>
                          <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
                          <Badge className="text-[10px]" style={{ background: STATUS_COLORS[r.status] ?? undefined }}>{r.status}</Badge>
                        </div>
                        <div className="text-sm mt-0.5">
                          {r.customer_name ?? "고객"} {r.phone && <span className="text-muted-foreground">· {r.phone}</span>}
                        </div>
                        {(r as any).fail_reason && (
                          <div className="text-xs text-destructive mt-0.5">사유: {(r as any).fail_reason}</div>
                        )}
                        {r.content && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.content}</div>}
                        {/* 상담 로그 */}
                        {inquiryLogs.length > 0 && (
                          <div className="mt-1.5 pl-3 border-l-2 border-border/30 space-y-1">
                            {inquiryLogs.slice(0, 3).map((log) => (
                              <div key={log.id} className="text-[10px] text-muted-foreground">
                                <Badge variant="outline" className="text-[9px] h-3.5 mr-1">{log.action}</Badge>
                                {log.content && <span>{log.content}</span>}
                              </div>
                            ))}
                            {inquiryLogs.length > 3 && <div className="text-[10px] text-muted-foreground">+{inquiryLogs.length - 3}건 더…</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {detailRows.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">데이터 없음</div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
