import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, ArrowLeft, Plus, FileText, CheckCircle2 } from "lucide-react";
import { useSegPartners, useSegActivities, type SegActivity } from "@/hooks/useSegPartners";
import { addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PartnerDetailDrawer } from "@/components/seg/PartnerDetailDrawer";
import { QuickScheduleDialog } from "@/components/seg/QuickScheduleDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TYPE_DOT: Record<string, string> = {
  방문: "bg-blue-500",
  MOU: "bg-indigo-500",
  상담: "bg-sky-500",
  전화: "bg-cyan-500",
  제안: "bg-purple-500",
  계약: "bg-emerald-500",
  사후관리: "bg-amber-500",
  이벤트: "bg-pink-500",
  기타: "bg-muted-foreground",
};

// 활동 유형별 파스텔톤 칩 색상 (라이트/다크 모두 시인성 확보)
const TYPE_CHIP: Record<string, string> = {
  방문: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  MOU: "bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  상담: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  전화: "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  제안: "bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  계약: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  사후관리: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  이벤트: "bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
  기타: "bg-slate-100 text-slate-800 dark:bg-slate-700/60 dark:text-slate-100",
};

const PRIORITY_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: "상", cls: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300" },
  mid:  { label: "중", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" },
  low:  { label: "하", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" },
};

export default function SegCalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const { activities, refresh } = useSegActivities();
  const { partners } = useSegPartners();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [drawerPartner, setDrawerPartner] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDate, setQuickDate] = useState<string | undefined>(undefined);
  const [listSort, setListSort] = useState<"date" | "recent">("date");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "done">("all");

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const filteredActs = useMemo(() => {
    if (filter === "mine" && user) return activities.filter((a) => a.created_by === user.id || a.assignee === user.id);
    return activities;
  }, [activities, filter, user]);

  // map by date string -> [{ kind: 'do' | 'next', activity }]
  const byDate = useMemo(() => {
    const m = new Map<string, { kind: "do" | "next"; act: SegActivity }[]>();
    filteredActs.forEach((a) => {
      const arr1 = m.get(a.activity_date) ?? [];
      arr1.push({ kind: "do", act: a });
      m.set(a.activity_date, arr1);
      if (a.next_action_date) {
        const arr2 = m.get(a.next_action_date) ?? [];
        arr2.push({ kind: "next", act: a });
        m.set(a.next_action_date, arr2);
      }
    });
    return m;
  }, [filteredActs]);

  const partnerById = useMemo(() => {
    const m = new Map<string, any>();
    partners.forEach((p) => m.set(p.id, p));
    return m;
  }, [partners]);

  const today = new Date();
  const dayActs = selectedDay ? (byDate.get(format(selectedDay, "yyyy-MM-dd")) ?? []) : [];

  // 하단 종합 리스트: 선택 날짜가 있으면 그 날만, 없으면 현재 월 전체
  const listActs = useMemo(() => {
    let base: SegActivity[];
    if (selectedDay) {
      const key = format(selectedDay, "yyyy-MM-dd");
      base = filteredActs.filter((a) => a.activity_date === key);
    } else {
      const ms = startOfMonth(cursor);
      const me = endOfMonth(cursor);
      base = filteredActs.filter((a) => {
        const d = new Date(a.activity_date + "T00:00:00");
        return d >= ms && d <= me;
      });
    }
    if (statusFilter === "scheduled") base = base.filter((a) => !a.is_completed);
    else if (statusFilter === "done") base = base.filter((a) => a.is_completed);
    if (listSort === "recent") {
      return [...base].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }
    return [...base].sort((a, b) => {
      const k = (a.activity_date ?? "").localeCompare(b.activity_date ?? "");
      if (k !== 0) return k;
      return (a.activity_time ?? "").localeCompare(b.activity_time ?? "");
    });
  }, [filteredActs, selectedDay, cursor, listSort, statusFilter]);

  const openQuickFor = (d: Date) => {
    setQuickDate(format(d, "yyyy-MM-dd"));
    setQuickOpen(true);
  };

  const toggleComplete = async (a: SegActivity) => {
    const next = !a.is_completed;
    const { error } = await (supabase as any)
      .from("seg_activities")
      .update({ is_completed: next, completed_at: next ? new Date().toISOString() : null })
      .eq("id", a.id);
    if (error) toast.error(error.message);
    else { toast.success(next ? "완료 처리" : "예정으로 변경"); refresh(); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/seg-partners")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="size-11 rounded-xl bg-slate-900 dark:bg-slate-100 grid place-items-center shadow-md">
            <CalIcon className="size-5 text-slate-100 dark:text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">SEG 영업 스케줄</h1>
            <p className="text-xs text-muted-foreground">날짜 클릭 → 새 일정 등록 · 하단 리스트에서 진행 상태 관리</p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 직원</SelectItem>
              <SelectItem value="mine">내 일정만</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, -1))}><ChevronLeft className="size-4" /></Button>
          <div className="px-3 py-2 rounded-md border min-w-[120px] text-center font-semibold">
            {format(cursor, "yyyy년 M월", { locale: ko })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, 1))}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>오늘</Button>
          <Button size="sm" onClick={() => openQuickFor(selectedDay ?? new Date())}>
            <Plus className="size-4 mr-1" /> 새 일정
          </Button>
        </div>
      </header>

      <Card className="p-3 border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["일","월","화","수","목","금","토"].map((d, i) => (
            <div key={d} className={`text-xs font-semibold text-center py-1 ${i===0?'text-rose-500':i===6?'text-blue-500':'text-muted-foreground'}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const items = byDate.get(key) ?? [];
            const inMonth = isSameMonth(d, cursor);
            const isToday = isSameDay(d, today);
            const isSel = selectedDay && isSameDay(d, selectedDay);
            return (
              <div
                key={key}
                onClick={() => setSelectedDay(d)}
                onDoubleClick={() => openQuickFor(d)}
                className={cn(
                  "group relative min-h-[96px] p-1.5 rounded-lg border text-left cursor-pointer transition-colors",
                  isSel ? "border-slate-900 dark:border-slate-100 ring-2 ring-slate-900/20 dark:ring-slate-100/20" : "border-border/50 hover:border-slate-400 dark:hover:border-slate-500",
                  inMonth ? "bg-white dark:bg-card" : "bg-muted/20 opacity-60",
                  isToday && "bg-blue-50 dark:bg-blue-950/30 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/30",
                )}
              >
                <div className="text-xs font-medium mb-1 flex items-center justify-between">
                  <span className={isToday ? "text-blue-600 dark:text-blue-300 font-bold" : ""}>{format(d, "d")}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openQuickFor(d); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-muted"
                    title="새 일정"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((it, i) => {
                    const name = it.act.title || partnerById.get(it.act.partner_id)?.company_name || "-";
                    const chip = TYPE_CHIP[it.act.activity_type] ?? TYPE_CHIP["기타"];
                    return (
                      <div key={i} className={cn(
                        "text-[10px] flex items-center gap-1 px-1 py-0.5 rounded truncate",
                        it.kind === "do" && it.act.is_completed
                          ? "opacity-40 line-through bg-muted/40"
                          : chip,
                      )}>
                        <span className={`size-1.5 rounded-full shrink-0 ${TYPE_DOT[it.act.activity_type] ?? "bg-muted-foreground"} ${it.kind === "next" ? "ring-1 ring-amber-500" : ""}`} />
                        <span className="truncate font-medium">{name}</span>
                      </div>
                    );
                  })}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{items.length - 3}건</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 하단: 종합 리스트 */}
      <Card className="p-4 border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="font-semibold flex items-center gap-2">
            {selectedDay ? (
              <>
                <span>{format(selectedDay, "yyyy년 M월 d일 (eee)", { locale: ko })}</span>
                <Badge variant="outline">{listActs.length}건</Badge>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedDay(null)}>전체 보기</Button>
              </>
            ) : (
              <>
                <span>{format(cursor, "yyyy년 M월", { locale: ko })} 전체 일정</span>
                <Badge variant="outline">{listActs.length}건</Badge>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="scheduled">예정</SelectItem>
                <SelectItem value="done">완료</SelectItem>
              </SelectContent>
            </Select>
            <Select value={listSort} onValueChange={(v: any) => setListSort(v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date">날짜순</SelectItem>
                <SelectItem value="recent">최신 등록순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {listActs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">등록된 일정이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left font-medium py-2 px-2 w-[110px]">날짜</th>
                  <th className="text-left font-medium py-2 px-2">활동명</th>
                  <th className="text-left font-medium py-2 px-2 w-[100px]">담당자</th>
                  <th className="text-left font-medium py-2 px-2 w-[90px]">타사등록</th>
                  <th className="text-left font-medium py-2 px-2 min-w-[280px]">메모</th>
                  <th className="text-left font-medium py-2 px-2 w-[80px]">중요도</th>
                  <th className="text-left font-medium py-2 px-2 w-[80px]">상태</th>
                  <th className="text-right font-medium py-2 px-2 w-[160px]">액션</th>
                </tr>
              </thead>
              <tbody>
                {listActs.map((a) => {
                  const p = partnerById.get(a.partner_id);
                  const done = a.is_completed;
                  const pri = (a.custom_fields as any)?.priority as string | undefined;
                  const priInfo = pri ? PRIORITY_BADGE[pri] : undefined;
                  const name = a.title || p?.company_name || "-";
                  return (
                    <tr key={a.id} className={cn(
                      "border-b border-border/40 hover:bg-muted/40 transition-colors",
                      done && "opacity-55",
                    )}>
                      <td className="py-2 px-2 align-top">
                        <div className="font-mono tabular-nums text-xs">{a.activity_date}</div>
                        <div className="text-[10px] text-muted-foreground">등록 {a.created_at?.slice(0,10)}</div>
                      </td>
                      <td className="py-2 px-2 align-top">
                        <button
                          onClick={() => { if (p) { setDrawerPartner(p); setDrawerOpen(true); } }}
                          className="font-semibold hover:underline text-left text-sm"
                        >
                          {name}
                        </button>
                      </td>
                      <td className="py-2 px-2 align-top text-xs">{a.assignee_name ?? "-"}</td>
                      <td className="py-2 px-2 align-top text-xs tabular-nums">
                        {(() => {
                          const c = (a.custom_fields as any)?.partner_count;
                          return c != null && c !== "" ? `${c}건` : <span className="text-muted-foreground">-</span>;
                        })()}
                      </td>
                      <td className="py-2 px-2 align-top">
                        {a.content
                          ? <div className="text-[11px] text-foreground/80 whitespace-pre-wrap break-words leading-relaxed">{a.content}</div>
                          : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2 px-2 align-top">
                        {priInfo ? (
                          <Badge variant="outline" className={cn("h-5 text-[10px]", priInfo.cls)}>{priInfo.label}</Badge>
                        ) : <span className="text-xs text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2 px-2 align-top">
                        {done ? (
                          <Badge variant="outline" className="h-5 text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">완료</Badge>
                        ) : (
                          <Badge variant="outline" className="h-5 text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-300">예정</Badge>
                        )}
                      </td>
                      <td className="py-2 px-2 align-top">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleComplete(a)}>
                            <CheckCircle2 className="size-3.5 mr-1" />
                            {done ? "예정" : "완료"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              const params = new URLSearchParams();
                              const company = p?.company_name ?? a.title ?? "";
                              if (company) params.set("customer_name", company);
                              if (a.assignee_name) params.set("manager", a.assignee_name);
                              params.set("from_inquiry", `seg:${a.id}`);
                              navigate(`/input?${params.toString()}`);
                            }}
                          >
                            <FileText className="size-3.5 mr-1" /> 실적등록
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <PartnerDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} partner={drawerPartner} />
      <QuickScheduleDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        defaultDate={quickDate}
        onSaved={refresh}
      />
    </div>
  );
}