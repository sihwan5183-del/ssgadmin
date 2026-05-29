import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, CheckCircle2, Loader2, Phone, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Navigate } from "react-router-dom";

interface SaleRow {
  id: string;
  customer_name: string | null;
  phone: string | null;
  open_date: string | null;
  rate_plan: string | null;
  sale_type: string | null;
  plan_change_due_date: string;
  plan_change_completed_at: string | null;
  plan_change_note: string | null;
  plan_change_target_plan: string | null;
}

type FilterMode = "all" | "pending" | "done";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function monthRange(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { startDate: ymd(first), endDate: ymd(last) };
}

export function PlanChangeCalendarView() {
  const today = new Date();
  const [cursor, setCursor] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const [filter, setFilter] = useState<FilterMode>("all");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(ymd(today));

  const range = useMemo(() => monthRange(cursor.y, cursor.m), [cursor]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sales")
      .select(
        "id, customer_name, phone, open_date, rate_plan, sale_type, plan_change_due_date, plan_change_completed_at, plan_change_note, plan_change_target_plan"
      )
      .gte("plan_change_due_date", range.startDate)
      .lte("plan_change_due_date", range.endDate)
      .order("plan_change_due_date");
    if (error) toast.error("불러오기 실패: " + error.message);
    setRows(((data ?? []) as unknown) as SaleRow[]);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`plan-change-${range.startDate}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales" },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "done") return rows.filter((r) => r.plan_change_completed_at);
    return rows.filter((r) => !r.plan_change_completed_at);
  }, [rows, filter]);

  // 날짜별 그룹
  const byDay = useMemo(() => {
    const map = new Map<string, { total: number; done: number; pending: number }>();
    rows.forEach((r) => {
      const d = r.plan_change_due_date;
      const cur = map.get(d) ?? { total: 0, done: 0, pending: 0 };
      cur.total += 1;
      if (r.plan_change_completed_at) cur.done += 1;
      else cur.pending += 1;
      map.set(d, cur);
    });
    return map;
  }, [rows]);

  // 월 그리드 생성
  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startWeekday = first.getDay();
    const lastDate = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: Array<{ day?: number; iso?: string }> = [];
    for (let i = 0; i < startWeekday; i++) cells.push({});
    for (let d = 1; d <= lastDate; d++) {
      cells.push({ day: d, iso: ymd(new Date(cursor.y, cursor.m, d)) });
    }
    while (cells.length % 7 !== 0) cells.push({});
    return cells;
  }, [cursor]);

  const dayRows = useMemo(
    () => filteredRows.filter((r) => r.plan_change_due_date === selectedDay),
    [filteredRows, selectedDay]
  );

  const monthLabel = `${cursor.y}년 ${cursor.m + 1}월`;

  const handleComplete = async (sale: SaleRow) => {
    const { error } = await supabase
      .from("sales")
      .update({ plan_change_completed_at: new Date().toISOString() })
      .eq("id", sale.id);
    if (error) toast.error("처리 실패: " + error.message);
    else toast.success("변경 완료로 처리되었습니다");
  };

  const handleRevert = async (sale: SaleRow) => {
    const { error } = await supabase
      .from("sales")
      .update({ plan_change_completed_at: null })
      .eq("id", sale.id);
    if (error) toast.error("되돌리기 실패: " + error.message);
    else toast.success("미처리로 되돌렸습니다");
  };

  return (
    <div>
      <Card className="p-4 glass mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCursor((c) => {
                  const m = c.m - 1;
                  return m < 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m };
                })
              }
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-base font-semibold tracking-tight px-2 min-w-[110px] text-center">
              {monthLabel}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                setCursor((c) => {
                  const m = c.m + 1;
                  return m > 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m };
                })
              }
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => {
                const t = new Date();
                setCursor({ y: t.getFullYear(), m: t.getMonth() });
                setSelectedDay(ymd(t));
              }}
            >
              오늘
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterMode)}>
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="pending">미처리</SelectItem>
                <SelectItem value="done">변경완료</SelectItem>
              </SelectContent>
            </Select>
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="grid grid-cols-7 mt-4 gap-1 text-[11px] text-muted-foreground">
          {WEEK.map((w, i) => (
            <div
              key={w}
              className={cn(
                "py-1 text-center font-medium",
                i === 0 && "text-rose-400",
                i === 6 && "text-sky-400"
              )}
            >
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, idx) => {
            if (!cell.iso) return <div key={idx} className="h-20 rounded-md" />;
            const stats = byDay.get(cell.iso);
            const visibleCount =
              filter === "done"
                ? stats?.done ?? 0
                : filter === "pending"
                  ? stats?.pending ?? 0
                  : stats?.total ?? 0;
            const isToday = cell.iso === ymd(today);
            const isSelected = cell.iso === selectedDay;
            const allDone = stats && stats.total > 0 && stats.pending === 0;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(cell.iso!)}
                className={cn(
                  "h-20 rounded-md border text-left p-1.5 transition-all flex flex-col",
                  "border-border/40 bg-background/30 hover:bg-background/60",
                  isSelected && "ring-2 ring-primary border-primary",
                  isToday && !isSelected && "border-primary/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isToday && "text-primary"
                    )}
                  >
                    {cell.day}
                  </span>
                  {allDone && <CheckCircle2 className="size-3 text-success" />}
                </div>
                {visibleCount > 0 && (
                  <div className="mt-auto">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-5",
                        filter === "done"
                          ? "border-success/40 text-success"
                          : filter === "pending"
                            ? "border-amber-400/40 text-amber-300"
                            : "border-primary/40 text-primary"
                      )}
                    >
                      {visibleCount}명
                    </Badge>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-0 glass overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <h3 className="font-semibold text-sm">
            {selectedDay} 변경 대상 ({dayRows.length}명)
          </h3>
          <Badge variant="outline" className="text-[10px]">
            필터: {filter === "all" ? "전체" : filter === "done" ? "변경완료" : "미처리"}
          </Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground bg-muted/30 border-b border-border/40">
              <tr>
                <th className="text-left px-4 py-2.5">고객명</th>
                <th className="text-left px-3 py-2.5">연락처</th>
                <th className="text-left px-3 py-2.5">개통일</th>
                <th className="text-left px-3 py-2.5">가입조건</th>
                <th className="text-left px-3 py-2.5">기존 요금제</th>
                <th className="text-left px-3 py-2.5">변경할 요금제</th>
                <th className="text-center px-3 py-2.5">상태</th>
                <th className="text-right px-3 py-2.5">처리</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-muted-foreground">
                    해당 일자에 표시할 대상이 없습니다
                  </td>
                </tr>
              )}
              {dayRows.map((r) => {
                const done = !!r.plan_change_completed_at;
                return (
                  <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{r.customer_name ?? "-"}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {r.phone ? (
                        <a
                          href={`tel:${r.phone}`}
                          className="inline-flex items-center gap-1 hover:text-primary"
                        >
                          <Phone className="size-3" />
                          {r.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs">{r.open_date ?? "-"}</td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className="text-[10px]">
                        {r.sale_type ?? "-"}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-xs">{r.rate_plan ?? "-"}</td>
                    <td className="px-3 py-3 text-xs">
                      {r.plan_change_target_plan ? (
                        <span className="inline-flex items-center gap-1 text-primary font-medium">
                          → {r.plan_change_target_plan}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {done ? (
                        <Badge className="bg-success/15 text-success border border-success/30">
                          완료
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-amber-400/40 text-amber-300"
                        >
                          미처리
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {done ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRevert(r)}
                          className="gap-1 text-xs"
                        >
                          <RotateCcw className="size-3" /> 되돌리기
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleComplete(r)}
                          className="gap-1 text-xs"
                        >
                          <CheckCircle2 className="size-3.5" /> 변경 완료
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

      <p className="text-[11px] text-muted-foreground mt-3">
        💡 캘린더의 숫자는 현재 필터 기준입니다. '미처리'로 두면 아직 변경되지 않은 인원만 한눈에 볼 수 있습니다.
      </p>
    </div>
  );
}

export default function PlanChangeCalendarPage() {
  // 사이드바 메뉴에서 제거됨 — [검수 관리] 내부 탭으로 통합 리다이렉트
  return <Navigate to="/activities?tab=plan-change" replace />;
}