import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, ChevronRight, Phone, CheckCircle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface InquiryRow {
  id: string;
  inquiry_date: string;
  channel: string;
  customer_name: string | null;
  status: string;
  fail_reason: string | null;
  manager: string | null;
  last_action_at: string | null;
  created_at: string;
}

interface LogEntry {
  id: string;
  action: string;
  content: string | null;
  created_at: string;
}

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const statusIcon = (s: string) => {
  if (s === "개통완료") return <CheckCircle className="size-3.5 text-emerald-400" />;
  if (s === "실패") return <XCircle className="size-3.5 text-destructive" />;
  return <Clock className="size-3.5 text-amber-400" />;
};

export const StaffTimelinePanel = ({ rows }: { rows: InquiryRow[] }) => {
  const [selectedManager, setSelectedManager] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({});
  const [loadingLogs, setLoadingLogs] = useState(false);

  const staffStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; success: number; failed: number; pending: number }>();
    rows.forEach((r) => {
      const mgr = r.manager || "미배정";
      const cur = map.get(mgr) ?? { name: mgr, total: 0, success: 0, failed: 0, pending: 0 };
      cur.total++;
      if (r.status === "개통완료") cur.success++;
      else if (r.status === "실패") cur.failed++;
      else cur.pending++;
      map.set(mgr, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const managerRows = useMemo(() => {
    if (!selectedManager) return [];
    return rows
      .filter((r) => (r.manager || "미배정") === selectedManager)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, selectedManager]);

  useEffect(() => {
    if (!selectedManager || managerRows.length === 0) return;
    setLoadingLogs(true);
    const ids = managerRows.map((r) => r.id);
    supabase
      .from("inquiry_logs")
      .select("*")
      .in("inquiry_id", ids.slice(0, 50))
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        const map: Record<string, LogEntry[]> = {};
        (data ?? []).forEach((log: any) => {
          if (!map[log.inquiry_id]) map[log.inquiry_id] = [];
          map[log.inquiry_id].push(log);
        });
        setLogs(map);
        setLoadingLogs(false);
      });
  }, [selectedManager, managerRows]);

  return (
    <>
      <Card className="glass border-border/40 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="size-4 text-primary" />
          <h4 className="text-sm font-semibold">담당자별 상세 리포트</h4>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {staffStats.map((s) => {
            const rate = s.total > 0 ? Math.round((s.success / s.total) * 100) : 0;
            return (
              <button
                key={s.name}
                onClick={() => setSelectedManager(s.name)}
                className="text-left p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-accent/30 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{s.name}</span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                  <span>총 {s.total}건</span>
                  <span className="text-emerald-400">{s.success}성공</span>
                  <span className="text-destructive">{s.failed}실패</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${rate}%` }}
                  />
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">{rate}% 성공률</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Staff Detail Dialog */}
      <Dialog open={!!selectedManager} onOpenChange={(v) => !v && setSelectedManager(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4" />
              {selectedManager} — 상담 타임라인
            </DialogTitle>
          </DialogHeader>

          {loadingLogs ? (
            <div className="text-center text-sm text-muted-foreground py-8">불러오는 중…</div>
          ) : managerRows.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">데이터 없음</div>
          ) : (
            <div className="space-y-3">
              {managerRows.map((r) => (
                <div key={r.id} className="rounded-lg border border-border/40 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    {statusIcon(r.status)}
                    <span className="text-sm font-medium">{r.customer_name ?? "고객"}</span>
                    <Badge variant="outline" className="text-[10px]">{r.channel}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        r.status === "개통완료" && "border-emerald-500/40 text-emerald-400",
                        r.status === "실패" && "border-destructive/40 text-destructive",
                      )}
                    >
                      {r.status}
                    </Badge>
                    {r.fail_reason && (
                      <span className="text-[10px] text-muted-foreground">({r.fail_reason})</span>
                    )}
                    <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                      {r.inquiry_date}
                    </span>
                  </div>

                  {/* Timeline for this inquiry */}
                  <div className="ml-4 border-l border-border/40 pl-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <div className="size-1.5 rounded-full bg-primary -ml-[0.9375rem]" />
                      <span className="tabular-nums">{formatTime(r.created_at)}</span>
                      <span>인입 등록</span>
                    </div>
                    {(logs[r.id] ?? []).map((log) => (
                      <div key={log.id} className="flex items-start gap-2 text-[10px]">
                        <div className="size-1.5 rounded-full bg-muted-foreground mt-1 -ml-[0.9375rem]" />
                        <span className="text-muted-foreground tabular-nums shrink-0">
                          {formatTime(log.created_at)}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-3.5 px-1">{log.action}</Badge>
                        {log.content && <span className="text-foreground/70">{log.content}</span>}
                      </div>
                    ))}
                    {r.status === "개통완료" && (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-400">
                        <div className="size-1.5 rounded-full bg-emerald-500 -ml-[0.9375rem]" />
                        <span>개통 완료</span>
                      </div>
                    )}
                    {r.status === "실패" && (
                      <div className="flex items-center gap-2 text-[10px] text-destructive">
                        <div className="size-1.5 rounded-full bg-destructive -ml-[0.9375rem]" />
                        <span>실패 — {r.fail_reason || "사유 미입력"}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};