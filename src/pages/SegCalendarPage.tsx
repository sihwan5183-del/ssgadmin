import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalIcon, ArrowLeft } from "lucide-react";
import { useSegPartners, useSegActivities, type SegActivity } from "@/hooks/useSegPartners";
import { addMonths, format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { PartnerDetailDrawer } from "@/components/seg/PartnerDetailDrawer";

const TYPE_DOT: Record<string, string> = {
  방문: "bg-blue-500",
  전화: "bg-cyan-500",
  제안: "bg-purple-500",
  계약: "bg-emerald-500",
  사후관리: "bg-amber-500",
  이벤트: "bg-pink-500",
  기타: "bg-muted-foreground",
};

export default function SegCalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const { activities } = useSegActivities();
  const { partners } = useSegPartners();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [drawerPartner, setDrawerPartner] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/seg-partners")}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="size-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
            <CalIcon className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">SEG. 영업 캘린더</h1>
            <p className="text-xs text-muted-foreground">실선=활동 일자 · 점선/배지=다음 활동 예정일</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 일정</SelectItem>
              <SelectItem value="mine">내 일정</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, -1))}><ChevronLeft className="size-4" /></Button>
          <div className="px-3 py-2 rounded-md border min-w-[120px] text-center font-semibold">
            {format(cursor, "yyyy년 M월", { locale: ko })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setCursor((d) => addMonths(d, 1))}><ChevronRight className="size-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>오늘</Button>
        </div>
      </header>

      <Card className="p-3">
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
              <button
                key={key}
                onClick={() => setSelectedDay(d)}
                className={`min-h-[80px] p-1.5 rounded-lg border text-left transition-colors ${
                  isSel ? "border-primary ring-2 ring-primary/30" : "border-border/40 hover:border-primary/40"
                } ${inMonth ? "" : "opacity-40"} ${isToday ? "bg-primary/5" : ""}`}
              >
                <div className="text-xs font-medium mb-1 flex items-center justify-between">
                  <span className={isToday ? "text-primary font-bold" : ""}>{format(d, "d")}</span>
                  {items.length > 0 && <span className="text-[10px] text-muted-foreground">{items.length}</span>}
                </div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((it, i) => (
                    <div key={i} className={`text-[10px] truncate flex items-center gap-1 ${
                      it.kind === "do" && it.act.is_completed ? "opacity-50 line-through" : ""
                    }`}>
                      <span className={`size-1.5 rounded-full shrink-0 ${TYPE_DOT[it.act.activity_type] ?? "bg-muted-foreground"} ${it.kind === "next" ? "ring-1 ring-amber-500" : ""}`} />
                      <span className="truncate">{partnerById.get(it.act.partner_id)?.company_name ?? "-"}</span>
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3}</div>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedDay && (
        <Card className="p-4">
          <div className="font-semibold mb-3">{format(selectedDay, "yyyy년 M월 d일 (eee)", { locale: ko })} · {dayActs.length}건</div>
          {dayActs.length === 0 && <div className="text-sm text-muted-foreground">등록된 일정이 없습니다.</div>}
          <div className="space-y-2">
            {dayActs.map((it, i) => {
              const p = partnerById.get(it.act.partner_id);
              return (
                <button
                  key={i}
                  onClick={() => { setDrawerPartner(p); setDrawerOpen(true); }}
                  className="w-full text-left p-3 rounded-lg border hover:border-primary/40 transition-colors flex items-start gap-3"
                >
                  <div className={`size-2 rounded-full mt-2 ${TYPE_DOT[it.act.activity_type] ?? "bg-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{it.act.activity_type}</Badge>
                      <span className="font-medium">{p?.company_name ?? "-"}</span>
                      {it.kind === "next" && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline">예정</Badge>}
                      {it.act.is_completed && <Badge variant="outline" className="text-emerald-600">완료</Badge>}
                      {it.act.activity_time && <span className="text-xs text-muted-foreground">{it.act.activity_time}</span>}
                    </div>
                    {it.act.title && <div className="text-sm mt-0.5">{it.act.title}</div>}
                    {it.kind === "next" && it.act.next_action_note && <div className="text-xs text-muted-foreground mt-0.5">{it.act.next_action_note}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      <PartnerDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} partner={drawerPartner} />
    </div>
  );
}