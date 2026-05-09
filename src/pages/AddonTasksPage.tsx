import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, RotateCcw, Phone, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

interface AddonTask {
  id: string;
  sale_id: string;
  addon_name: string;
  due_date: string;
  completed_at: string | null;
  completed_by: string | null;
  completed_note: string | null;
  sales?: {
    customer_name: string | null;
    phone: string | null;
    open_date: string | null;
    created_by: string | null;
  } | null;
}

type FilterMode = "today" | "overdue" | "upcoming" | "done" | "all";

export default function AddonTasksPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AddonTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("today");
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const today = format(new Date(), "yyyy-MM-dd");

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("sales_addon_tasks")
      .select("*, sales:sale_id(customer_name, phone, open_date, created_by)")
      .order("due_date");
    if (error) toast.error("불러오기 실패: " + error.message);
    setRows((data ?? []) as AddonTask[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const ch = (supabase as any).channel("sales_addon_tasks")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales_addon_tasks" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "all") return true;
      if (filter === "done") return !!r.completed_at;
      if (filter === "today") return !r.completed_at && r.due_date === today;
      if (filter === "overdue") return !r.completed_at && r.due_date < today;
      if (filter === "upcoming") return !r.completed_at && r.due_date > today;
      return true;
    });
  }, [rows, filter, today]);

  const complete = async (t: AddonTask) => {
    const { error } = await (supabase as any).from("sales_addon_tasks").update({
      completed_at: new Date().toISOString(),
      completed_by: user?.id ?? null,
      completed_note: noteDraft[t.id] ?? t.completed_note ?? null,
    }).eq("id", t.id);
    if (error) return toast.error("처리 실패: " + error.message);
    toast.success("해지 완료로 기록되었습니다");
  };

  const revert = async (t: AddonTask) => {
    const { error } = await (supabase as any).from("sales_addon_tasks").update({
      completed_at: null, completed_by: null, completed_note: null,
    }).eq("id", t.id);
    if (error) toast.error("되돌리기 실패: " + error.message);
    else toast.success("미처리로 되돌렸습니다");
  };

  return (
    <div>
      <Header
        title="부가서비스 관리"
        subtitle="개통일 + 유지 일수 기준으로 자동 생성된 부가서비스 해지 작업을 관리합니다"
        showScopeToggle={false} showPeriodFilter={false}
      />

      <Card className="p-4 glass mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <ShieldAlert className="size-4 text-primary" />
            <span className="font-semibold">총 {filtered.length}건</span>
            <span className="text-muted-foreground">/ 전체 {rows.length}건</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">오늘 해지 대상</SelectItem>
                <SelectItem value="overdue">기한 경과</SelectItem>
                <SelectItem value="upcoming">예정</SelectItem>
                <SelectItem value="done">완료</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        </div>
      </Card>

      <Card className="p-0 glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/40">
              <tr>
                <th className="text-left px-4 py-2.5">고객</th>
                <th className="text-left px-3 py-2.5">연락처</th>
                <th className="text-left px-3 py-2.5">부가서비스</th>
                <th className="text-left px-3 py-2.5">개통일</th>
                <th className="text-left px-3 py-2.5">해지 예정일</th>
                <th className="text-left px-3 py-2.5 min-w-[180px]">처리 메모</th>
                <th className="text-center px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">처리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">표시할 작업이 없습니다</td></tr>
              )}
              {filtered.map((t) => {
                const done = !!t.completed_at;
                const overdue = !done && t.due_date < today;
                const isToday = !done && t.due_date === today;
                return (
                  <tr key={t.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{t.sales?.customer_name ?? "-"}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {t.sales?.phone ? (
                        <a href={`tel:${t.sales.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                          <Phone className="size-3" />{t.sales.phone}
                        </a>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-3"><Badge variant="outline" className="font-mono text-xs">{t.addon_name}</Badge></td>
                    <td className="px-3 py-3 text-xs">{t.sales?.open_date ?? "-"}</td>
                    <td className="px-3 py-3 text-xs font-medium">
                      <span className={overdue ? "text-destructive" : isToday ? "text-amber-500" : ""}>
                        {t.due_date}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        defaultValue={t.completed_note ?? ""}
                        onChange={(e) => setNoteDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                        placeholder="통화 결과 / 처리 메모"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      {done ? (
                        <Badge className="bg-success/15 text-success border border-success/30">해지완료</Badge>
                      ) : overdue ? (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">기한 경과</Badge>
                      ) : isToday ? (
                        <Badge variant="outline" className="border-amber-400/40 text-amber-300">오늘</Badge>
                      ) : (
                        <Badge variant="outline">예정</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {done ? (
                        <Button size="sm" variant="ghost" onClick={() => revert(t)} className="gap-1 text-xs">
                          <RotateCcw className="size-3" /> 되돌리기
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => complete(t)} className="gap-1 text-xs">
                          <CheckCircle2 className="size-3.5" /> 해지 완료
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
