import { useState, useMemo, useCallback, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PhoneOff, RefreshCw, XCircle, Phone, Search, Clock, AlertTriangle,
  MessageSquare, Plus, BarChart3, ListPlus, ChevronRight,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Funnel, FunnelChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePeriod } from "@/contexts/PeriodContext";
import { InquiryForm } from "@/components/inquiries/InquiryForm";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QuickLinksBar } from "@/components/dashboard/QuickLinksBar";

const CRM_STATUSES = ["미처리", "부재", "재케어(예약)", "성공(개통)", "실패(종결)"] as const;
type CrmStatus = (typeof CRM_STATUSES)[number];

const FAIL_REASONS = ["가격(지원금) 불만", "결합/위약금 문제", "기기 재고 없음", "타사 유지", "단순 변심", "연락 두절", "기타"] as const;

const STATUS_CONFIG: Record<string, { icon: typeof PhoneOff; color: string; label: string }> = {
  부재: { icon: PhoneOff, color: "hsl(35 90% 55%)", label: "부재" },
  "재케어(예약)": { icon: RefreshCw, color: "hsl(200 80% 55%)", label: "재케어(예약)" },
  "실패(종결)": { icon: XCircle, color: "hsl(0 70% 55%)", label: "실패(종결)" },
};

interface InquiryRow {
  id: string;
  inquiry_date: string;
  channel: string;
  customer_name: string | null;
  phone: string | null;
  content: string | null;
  manager: string | null;
  status: string;
  note: string | null;
  retry_at: string | null;
  fail_reason: string | null;
  last_action_at: string | null;
  created_by: string;
  created_at: string;
}

interface LogEntry {
  id: string;
  action: string;
  content: string | null;
  created_by: string;
  created_at: string;
}

// ── 방치 감지: 24시간 초과 ──
const isAbandoned = (lastAction: string | null) => {
  if (!lastAction) return true;
  return Date.now() - new Date(lastAction).getTime() > 24 * 60 * 60 * 1000;
};

const formatTime = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ── Summary Cards ──
function SummaryCards({ rows }: { rows: InquiryRow[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const todayRows = rows.filter((r) => r.inquiry_date === today);
  const absent = rows.filter((r) => r.status === "부재").length;
  const recare = rows.filter((r) => r.status === "재케어(예약)").length;
  const failed = rows.filter((r) => r.status === "실패(종결)").length;
  const total = rows.length;
  const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;

  const cards = [
    { label: "오늘 인입", value: todayRows.length, unit: "건", color: "text-foreground" },
    { label: "부재", value: absent, unit: "건", color: "text-amber-400" },
    { label: "재케어", value: recare, unit: "건", color: "text-blue-400" },
    { label: "실패율", value: failRate, unit: "%", color: "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="glass border-border/40 p-4">
          <div className="text-[11px] text-muted-foreground">{c.label}</div>
          <div className={cn("text-2xl font-bold tabular-nums mt-1", c.color)}>
            {c.value.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground ml-1">{c.unit}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Funnel Chart ──
function IntakeFunnel({ rows }: { rows: InquiryRow[] }) {
  const channels = useMemo(() => {
    const map = new Map<string, { total: number; absent: number; recare: number; failed: number; success: number }>();
    for (const r of rows) {
      const ch = r.channel || "기타";
      const cur = map.get(ch) ?? { total: 0, absent: 0, recare: 0, failed: 0, success: 0 };
      cur.total++;
      if (r.status === "부재") cur.absent++;
      else if (r.status === "재케어(예약)") cur.recare++;
      else if (r.status === "실패(종결)") cur.failed++;
      else if (r.status === "성공(개통)") cur.success++;
      map.set(ch, cur);
    }
    return Array.from(map.entries())
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // overall funnel
  const totalInquiries = rows.length;
  const contacted = rows.filter((r) => r.status !== "부재" && r.status !== "미처리").length;
  const caring = rows.filter((r) => ["재케어(예약)", "성공(개통)"].includes(r.status)).length;
  const converted = rows.filter((r) => r.status === "성공(개통)").length;

  const funnelData = [
    { name: "총 인입", value: totalInquiries, fill: "hsl(var(--primary))" },
    { name: "연결 성공", value: contacted, fill: "hsl(200 80% 55%)" },
    { name: "상담 진행", value: caring, fill: "hsl(35 90% 55%)" },
    { name: "개통 완료", value: converted, fill: "hsl(152 76% 50%)" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="glass border-border/40 p-4">
        <h4 className="text-sm font-semibold mb-3">전환 퍼널</h4>
        <div className="space-y-2">
          {funnelData.map((d, i) => {
            const pct = totalInquiries > 0 ? Math.round((d.value / totalInquiries) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 shrink-0">{d.name}</span>
                <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{ width: `${pct}%`, background: d.fill }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums">
                    {d.value}건 ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass border-border/40 p-4">
        <h4 className="text-sm font-semibold mb-3">채널별 이탈 현황</h4>
        {channels.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">데이터 없음</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channels.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="channel" fontSize={11} tickLine={false} axisLine={false} width={55} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="absent" name="부재" stackId="a" fill="hsl(35 90% 55%)" />
                <Bar dataKey="recare" name="재케어" stackId="a" fill="hsl(200 80% 55%)" />
                <Bar dataKey="failed" name="실패" stackId="a" fill="hsl(0 70% 55%)" />
                <Bar dataKey="success" name="개통" stackId="a" fill="hsl(152 76% 50%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Timeline Dialog ──
function TimelineDialog({
  inquiry,
  open,
  onOpenChange,
  onLogAdded,
}: {
  inquiry: InquiryRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLogAdded: () => void;
}) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [action, setAction] = useState("전화");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!inquiry) return;
    supabase
      .from("inquiry_logs")
      .select("*")
      .eq("inquiry_id", inquiry.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLogs((data as LogEntry[]) ?? []));
  }, [inquiry, saving]);

  const addLog = async () => {
    if (!inquiry || !user) return;
    setSaving(true);
    const { error } = await supabase.from("inquiry_logs").insert({
      inquiry_id: inquiry.id,
      action,
      content: content || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    toast.success("상담 기록 추가");
    onLogAdded();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            상담 히스토리 — {inquiry?.customer_name ?? "고객"}
          </DialogTitle>
        </DialogHeader>

        {/* Add log */}
        <div className="flex gap-2 items-end">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-24 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["전화", "문자", "카카오톡", "방문", "메모"].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="상담 내용 입력…"
            className="flex-1 h-9 text-sm"
          />
          <Button size="sm" onClick={addLog} disabled={saving} className="h-9">
            <Plus className="size-3.5 mr-1" /> 추가
          </Button>
        </div>

        {/* Timeline */}
        <div className="mt-3 space-y-0">
          {logs.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">상담 기록이 없습니다</div>
          ) : (
            logs.map((log, i) => (
              <div key={log.id} className="flex gap-3 py-2.5 border-b border-border/30 last:border-0">
                <div className="flex flex-col items-center">
                  <div className="size-2 rounded-full bg-primary mt-1.5" />
                  {i < logs.length - 1 && <div className="w-px flex-1 bg-border/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-4">{log.action}</Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {formatTime(log.created_at)}
                    </span>
                  </div>
                  {log.content && (
                    <p className="text-xs text-foreground/80 mt-1">{log.content}</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
const ChannelIntakePage = () => {
  const { startDate, endDate } = usePeriod();
  const { user } = useAuth();
  const [rows, setRows] = useState<InquiryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [search, setSearch] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryRow | null>(null);
  const [editingRow, setEditingRow] = useState<InquiryRow | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editRetryAt, setEditRetryAt] = useState("");
  const [editFailReason, setEditFailReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .gte("inquiry_date", startDate)
      .lte("inquiry_date", endDate)
      .order("inquiry_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    setRows((data as InquiryRow[]) ?? []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "전체") list = list.filter((r) => r.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.customer_name, r.phone, r.channel, r.manager, r.content, r.note]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [rows, statusFilter, search]);

  const openStatusEditor = (row: InquiryRow) => {
    setEditingRow(row);
    setEditStatus(row.status);
    setEditRetryAt(row.retry_at?.slice(0, 16) ?? "");
    setEditFailReason(row.fail_reason ?? "");
  };

  const saveStatus = async () => {
    if (!editingRow) return;
    const update = {
      status: editStatus,
      retry_at: ["부재", "재케어(예약)"].includes(editStatus) && editRetryAt ? new Date(editRetryAt).toISOString() : null as string | null,
      fail_reason: editStatus === "실패(종결)" ? (editFailReason || null) : null as string | null,
      last_action_at: new Date().toISOString() as string | null,
    } as const;
    const { error } = await supabase.from("inquiries").update(update).eq("id", editingRow.id);
    if (error) { toast.error(error.message); return; }
    toast.success("상태 변경 완료");
    setEditingRow(null);
    refresh();
  };

  const statusCounts = useMemo(() => {
    const map: Record<string, number> = { 전체: rows.length };
    CRM_STATUSES.forEach((s) => { map[s] = rows.filter((r) => r.status === s).length; });
    return map;
  }, [rows]);

  return (
    <>
      <Header title="채널별 인입 정리" subtitle="인입 현황판 · 고객 관리 · CRM" />

      <div className="space-y-5">
        <QuickLinksBar />
        <SummaryCards rows={rows} />
        <IntakeFunnel rows={rows} />

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {["전체", ...CRM_STATUSES].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className="h-8 text-xs gap-1.5"
            >
              {s}
              <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-1">
                {statusCounts[s] ?? 0}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Search + New */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명 · 전화번호 · 채널 · 담당자 검색…"
              className="h-9 pl-9 bg-input/60"
            />
          </div>
        </div>

        {/* Input form (collapsible) */}
        <InquiryForm onSaved={refresh} />

        {/* List */}
        <Card className="glass border-border/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">날짜</th>
                  <th className="text-left px-3 py-2">채널</th>
                  <th className="text-left px-3 py-2">고객</th>
                  <th className="text-left px-3 py-2">연락처</th>
                  <th className="text-left px-3 py-2">상태</th>
                  <th className="text-left px-3 py-2">재연락</th>
                  <th className="text-left px-3 py-2">최종액션</th>
                  <th className="text-left px-3 py-2">담당</th>
                  <th className="text-right px-3 py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">불러오는 중…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">데이터 없음</td></tr>
                ) : (
                  filtered.map((r) => {
                    const abandoned = isAbandoned(r.last_action_at) && !["성공(개통)", "실패(종결)"].includes(r.status);
                    return (
                      <tr key={r.id} className={cn("border-t border-border/30 hover:bg-muted/20", abandoned && "bg-destructive/5")}>
                        <td className="px-3 py-2 text-xs tabular-nums">{r.inquiry_date}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs font-medium">{r.customer_name ?? "-"}</td>
                        <td className="px-3 py-2 text-xs">
                          {r.phone ? (
                            <a href={`tel:${r.phone}`} className="flex items-center gap-1 text-foreground/80 hover:text-foreground">
                              <Phone className="size-3" /> {r.phone}
                            </a>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              className={cn(
                                "text-[10px]",
                                r.status === "부재" && "bg-amber-100 text-amber-700 border-amber-300",
                                r.status === "재케어(예약)" && "bg-blue-500/20 text-blue-300 border-blue-500/30",
                                r.status === "실패(종결)" && "bg-destructive/20 text-destructive border-destructive/30",
                                r.status === "성공(개통)" && "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                                r.status === "미처리" && "bg-muted text-muted-foreground border-border",
                              )}
                              variant="outline"
                            >
                              {r.status}
                            </Badge>
                            {abandoned && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1 animate-pulse">
                                방치
                              </Badge>
                            )}
                          </div>
                          {r.fail_reason && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                              사유: {r.fail_reason}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-[10px] tabular-nums text-muted-foreground">
                          {r.retry_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" /> {formatTime(r.retry_at)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-[10px] tabular-nums text-muted-foreground">
                          {formatTime(r.last_action_at)}
                        </td>
                        <td className="px-3 py-2 text-xs">{r.manager ?? "-"}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button size="sm" variant="ghost" className="h-7 text-xs mr-1" onClick={() => setSelectedInquiry(r)}>
                            <MessageSquare className="size-3 mr-1" /> 기록
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openStatusEditor(r)}>
                            상태변경
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Timeline dialog */}
      <TimelineDialog
        inquiry={selectedInquiry}
        open={!!selectedInquiry}
        onOpenChange={(v) => !v && setSelectedInquiry(null)}
        onLogAdded={refresh}
      />

      {/* Status edit dialog */}
      <Dialog open={!!editingRow} onOpenChange={(v) => !v && setEditingRow(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>상태 변경 — {editingRow?.customer_name ?? "고객"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">상태</label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRM_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {["부재", "재케어(예약)"].includes(editStatus) && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {editStatus === "부재" ? "재연결 예정 시각" : "재연락 날짜"}
                </label>
                <Input
                  type="datetime-local"
                  value={editRetryAt}
                  onChange={(e) => setEditRetryAt(e.target.value)}
                  className="h-9"
                />
              </div>
            )}

            {editStatus === "실패(종결)" && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">거절 사유</label>
                <Select value={editFailReason} onValueChange={setEditFailReason}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="사유 선택" /></SelectTrigger>
                  <SelectContent>
                    {FAIL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditingRow(null)}>취소</Button>
              <Button onClick={saveStatus}>저장</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChannelIntakePage;