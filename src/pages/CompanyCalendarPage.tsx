import { useState, useMemo, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MapPin,
  User, Download, Link2, Pencil, Trash2, Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, addWeeks, subMonths, subWeeks, subDays, isSameDay, isSameMonth, isToday, parseISO } from "date-fns";
import { ko } from "date-fns/locale";

/* ── Category colors ── */
const CATEGORIES = [
  { value: "광고/마케팅", label: "광고/마케팅", bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300", dot: "bg-blue-500" },
  { value: "매장 점검", label: "매장 점검", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-300", dot: "bg-emerald-500" },
  { value: "본사 교육", label: "본사 교육", bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300", dot: "bg-violet-500" },
  { value: "프로모션", label: "프로모션", bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-300", dot: "bg-rose-500" },
  { value: "정책 배포", label: "정책 배포", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300", dot: "bg-amber-500" },
  { value: "회의", label: "회의", bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-300", dot: "bg-cyan-500" },
  { value: "기타", label: "기타", bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300", dot: "bg-gray-500" },
] as const;

function getCategoryStyle(cat: string) {
  return CATEGORIES.find((c) => c.value === cat) ?? CATEGORIES[CATEGORIES.length - 1];
}

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  start_date: string;
  end_date: string;
  all_day: boolean;
  location: string | null;
  assignee: string | null;
  store_id: string | null;
  is_important: boolean;
  created_by: string;
  created_at: string;
};

type ViewMode = "month" | "week" | "day";

const CompanyCalendarPage = () => {
  const { user } = useAuth();
  const { isAdmin, isManager } = useRole();
  const qc = useQueryClient();
  const canEdit = isAdmin || isManager;

  const [view, setView] = useState<ViewMode>("month");
  const [current, setCurrent] = useState(new Date());
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  /* ── date range for query ── */
  const range = useMemo(() => {
    if (view === "month") {
      const ms = startOfMonth(current);
      const me = endOfMonth(current);
      return { from: startOfWeek(ms, { weekStartsOn: 0 }), to: endOfWeek(me, { weekStartsOn: 0 }) };
    }
    if (view === "week") {
      return { from: startOfWeek(current, { weekStartsOn: 0 }), to: endOfWeek(current, { weekStartsOn: 0 }) };
    }
    return { from: current, to: current };
  }, [view, current]);

  const { data: events = [] } = useQuery({
    queryKey: ["calendar-events", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_date", range.from.toISOString())
        .lte("start_date", addDays(range.to, 1).toISOString())
        .order("start_date");
      return (data ?? []) as CalendarEvent[];
    },
  });

  const navigate = (dir: 1 | -1) => {
    if (view === "month") setCurrent((c) => (dir === 1 ? addMonths(c, 1) : subMonths(c, 1)));
    else if (view === "week") setCurrent((c) => (dir === 1 ? addWeeks(c, 1) : subWeeks(c, 1)));
    else setCurrent((c) => (dir === 1 ? addDays(c, 1) : subDays(c, 1)));
  };

  /* ── mutations ── */
  const saveMut = useMutation({
    mutationFn: async (ev: Partial<CalendarEvent> & { id?: string }) => {
      if (ev.id) {
        const { error } = await supabase.from("calendar_events").update({
          title: ev.title,
          description: ev.description,
          category: ev.category,
          start_date: ev.start_date,
          end_date: ev.end_date,
          all_day: ev.all_day,
          location: ev.location,
          assignee: ev.assignee,
          is_important: ev.is_important,
          updated_at: new Date().toISOString(),
        }).eq("id", ev.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("calendar_events").insert({
          title: ev.title!,
          description: ev.description,
          category: ev.category!,
          start_date: ev.start_date!,
          end_date: ev.end_date!,
          all_day: ev.all_day ?? false,
          location: ev.location,
          assignee: ev.assignee,
          is_important: ev.is_important ?? false,
          created_by: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("일정이 저장되었습니다");
      setFormOpen(false);
      setEditingEvent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("calendar_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-events"] });
      toast.success("일정이 삭제되었습니다");
      setSelected(null);
    },
  });

  /* ── Excel export ── */
  const handleExport = useCallback(() => {
    const rows = events.map((e) => ({
      제목: e.title,
      카테고리: e.category,
      시작일: format(parseISO(e.start_date), "yyyy-MM-dd HH:mm"),
      종료일: format(parseISO(e.end_date), "yyyy-MM-dd HH:mm"),
      종일: e.all_day ? "Y" : "N",
      장소: e.location ?? "",
      담당자: e.assignee ?? "",
      중요: e.is_important ? "Y" : "N",
      메모: e.description ?? "",
    }));
    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => `"${(r as any)[h]}"`).join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `전사캘린더_${format(current, "yyyyMM")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV 다운로드 완료");
  }, [events, current]);

  /* ── share ── */
  const shareEvent = (ev: CalendarEvent) => {
    const url = `${window.location.origin}/company-calendar?event=${ev.id}`;
    navigator.clipboard.writeText(url);
    toast.success("일정 링크가 클립보드에 복사되었습니다");
  };

  return (
    <>
      <Header title="전사 업무 캘린더" subtitle="팀 전체의 일정을 한눈에 확인하세요" />

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="month">월간</TabsTrigger>
            <TabsTrigger value="week">주간</TabsTrigger>
            <TabsTrigger value="day">일간</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="size-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent(new Date())}>오늘</Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {view === "month" && format(current, "yyyy년 M월", { locale: ko })}
            {view === "week" && `${format(startOfWeek(current, { weekStartsOn: 0 }), "M/d")} ~ ${format(endOfWeek(current, { weekStartsOn: 0 }), "M/d")}`}
            {view === "day" && format(current, "yyyy년 M월 d일 (EEE)", { locale: ko })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => navigate(1)}><ChevronRight className="size-4" /></Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="size-3.5" /> 엑셀
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => { setEditingEvent(null); setFormOpen(true); }} className="gap-1.5">
              <Plus className="size-3.5" /> 일정 등록
            </Button>
          )}
        </div>
      </div>

      {/* calendar body */}
      {view === "month" && <MonthView current={current} events={events} onSelect={setSelected} onDateClick={(d) => { setCurrent(d); setView("day"); }} />}
      {view === "week" && <WeekView current={current} events={events} onSelect={setSelected} />}
      {view === "day" && <DayView current={current} events={events} onSelect={setSelected} />}

      {/* detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.is_important && <Star className="size-4 text-amber-500 fill-amber-500" />}
                  {selected.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <Badge className={`${getCategoryStyle(selected.category).bg} ${getCategoryStyle(selected.category).text} ${getCategoryStyle(selected.category).border} border`}>
                  {selected.category}
                </Badge>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-3.5" />
                  {selected.all_day
                    ? format(parseISO(selected.start_date), "yyyy.MM.dd") + (isSameDay(parseISO(selected.start_date), parseISO(selected.end_date)) ? " (종일)" : ` ~ ${format(parseISO(selected.end_date), "MM.dd")}`)
                    : `${format(parseISO(selected.start_date), "yyyy.MM.dd HH:mm")} ~ ${format(parseISO(selected.end_date), "HH:mm")}`}
                </div>
                {selected.location && (
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-3.5" /> {selected.location}</div>
                )}
                {selected.assignee && (
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="size-3.5" /> {selected.assignee}</div>
                )}
                {selected.description && <p className="text-muted-foreground whitespace-pre-wrap">{selected.description}</p>}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => shareEvent(selected)} className="gap-1.5">
                    <Link2 className="size-3.5" /> 공유
                  </Button>
                  {canEdit && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => { setEditingEvent(selected); setFormOpen(true); setSelected(null); }} className="gap-1.5">
                        <Pencil className="size-3.5" /> 수정
                      </Button>
                      {isAdmin && (
                        <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(selected.id)} className="gap-1.5">
                          <Trash2 className="size-3.5" /> 삭제
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* form dialog */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        saving={saveMut.isPending}
        onSave={(ev) => saveMut.mutate(ev)}
      />
    </>
  );
};

export default CompanyCalendarPage;

/* ═══════════════ Month View ═══════════════ */
function MonthView({ current, events, onSelect, onDateClick }: {
  current: Date;
  events: CalendarEvent[];
  onSelect: (e: CalendarEvent) => void;
  onDateClick: (d: Date) => void;
}) {
  const monthStart = startOfMonth(current);
  const start = startOfWeek(monthStart, { weekStartsOn: 0 });
  const weeks: Date[][] = [];
  let day = start;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground border-b">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d} className="py-2">{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
          {week.map((d) => {
            const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_date), d));
            const inMonth = isSameMonth(d, current);
            return (
              <div
                key={d.toISOString()}
                className={`min-h-[80px] lg:min-h-[100px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors ${!inMonth ? "opacity-40" : ""} ${isToday(d) ? "bg-primary/5" : ""}`}
                onClick={() => onDateClick(d)}
              >
                <div className={`text-xs font-medium mb-0.5 ${isToday(d) ? "bg-primary text-primary-foreground rounded-full size-5 grid place-items-center mx-auto" : ""}`}>
                  {format(d, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((e) => {
                    const cat = getCategoryStyle(e.category);
                    return (
                      <div
                        key={e.id}
                        onClick={(ev) => { ev.stopPropagation(); onSelect(e); }}
                        className={`text-[10px] lg:text-xs px-1 py-0.5 rounded truncate ${cat.bg} ${cat.text} cursor-pointer hover:opacity-80`}
                      >
                        {e.is_important && "⭐ "}{e.title}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground text-center">+{dayEvents.length - 3}건</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </Card>
  );
}

/* ═══════════════ Week View ═══════════════ */
function WeekView({ current, events, onSelect }: { current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void }) {
  const start = startOfWeek(current, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7">
        {days.map((d) => (
          <div key={d.toISOString()} className="border-r last:border-r-0">
            <div className={`text-center py-2 border-b text-xs font-semibold ${isToday(d) ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
              {format(d, "EEE d", { locale: ko })}
            </div>
            <div className="p-1 space-y-1 min-h-[300px]">
              {events.filter((e) => isSameDay(parseISO(e.start_date), d)).map((e) => {
                const cat = getCategoryStyle(e.category);
                return (
                  <div
                    key={e.id}
                    onClick={() => onSelect(e)}
                    className={`text-[11px] px-1.5 py-1 rounded ${cat.bg} ${cat.text} ${cat.border} border cursor-pointer hover:opacity-80`}
                  >
                    <div className="font-medium truncate">{e.is_important && "⭐ "}{e.title}</div>
                    {!e.all_day && <div className="text-[10px] opacity-70">{format(parseISO(e.start_date), "HH:mm")}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ═══════════════ Day View ═══════════════ */
function DayView({ current, events, onSelect }: { current: Date; events: CalendarEvent[]; onSelect: (e: CalendarEvent) => void }) {
  const dayEvents = events.filter((e) => isSameDay(parseISO(e.start_date), current));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card className="overflow-hidden">
      <div className="divide-y">
        {hours.map((h) => {
          const hourEvents = dayEvents.filter((e) => {
            if (e.all_day) return h === 0;
            return parseISO(e.start_date).getHours() === h;
          });
          return (
            <div key={h} className="flex min-h-[48px]">
              <div className="w-16 shrink-0 text-xs text-muted-foreground text-right pr-2 pt-1">
                {h === 0 ? "종일" : `${String(h).padStart(2, "0")}:00`}
              </div>
              <div className="flex-1 border-l p-1 space-y-1">
                {hourEvents.map((e) => {
                  const cat = getCategoryStyle(e.category);
                  return (
                    <div
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={`text-xs px-2 py-1.5 rounded ${cat.bg} ${cat.text} ${cat.border} border cursor-pointer hover:opacity-80`}
                    >
                      <span className="font-medium">{e.is_important && "⭐ "}{e.title}</span>
                      {e.location && <span className="ml-2 opacity-70">📍 {e.location}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ═══════════════ Form Dialog ═══════════════ */
function EventFormDialog({ open, onOpenChange, event, saving, onSave }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  event: CalendarEvent | null;
  saving: boolean;
  onSave: (ev: Partial<CalendarEvent> & { id?: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("기타");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");
  const [assignee, setAssignee] = useState("");
  const [description, setDescription] = useState("");
  const [isImportant, setIsImportant] = useState(false);

  // reset when opened
  const handleOpenChange = (o: boolean) => {
    if (o) {
      if (event) {
        setTitle(event.title);
        setCategory(event.category);
        setStartDate(event.start_date.slice(0, 16));
        setEndDate(event.end_date.slice(0, 16));
        setAllDay(event.all_day);
        setLocation(event.location ?? "");
        setAssignee(event.assignee ?? "");
        setDescription(event.description ?? "");
        setIsImportant(event.is_important);
      } else {
        const now = new Date();
        setTitle("");
        setCategory("기타");
        setStartDate(format(now, "yyyy-MM-dd'T'HH:mm"));
        setEndDate(format(addDays(now, 0), "yyyy-MM-dd'T'23:59"));
        setAllDay(false);
        setLocation("");
        setAssignee("");
        setDescription("");
        setIsImportant(false);
      }
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? "일정 수정" : "새 일정 등록"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>제목 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="일정 제목" />
          </div>
          <div>
            <Label>카테고리</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-2">
                      <span className={`size-2.5 rounded-full ${c.dot}`} />
                      {c.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>시작일시</Label>
              <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>종료일시</Label>
              <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={allDay} onCheckedChange={setAllDay} />
              <Label className="text-sm">종일</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isImportant} onCheckedChange={setIsImportant} />
              <Label className="text-sm">⭐ 중요 일정</Label>
            </div>
          </div>
          <div>
            <Label>장소</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="장소 입력" />
          </div>
          <div>
            <Label>담당자</Label>
            <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="담당자명" />
          </div>
          <div>
            <Label>메모</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="상세 내용" rows={3} />
          </div>
          <Button
            className="w-full"
            disabled={!title.trim() || !startDate || !endDate || saving}
            onClick={() =>
              onSave({
                ...(event ? { id: event.id } : {}),
                title: title.trim(),
                category,
                start_date: new Date(startDate).toISOString(),
                end_date: new Date(endDate).toISOString(),
                all_day: allDay,
                location: location || null,
                assignee: assignee || null,
                description: description || null,
                is_important: isImportant,
              })
            }
          >
            {saving ? "저장 중..." : event ? "수정 완료" : "등록"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}