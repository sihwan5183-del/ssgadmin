import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Image as ImageIcon,
  Upload,
  Pencil,
  Trash2,
  Eye,
  MousePointerClick,
  Target,
  TrendingUp,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { usePeriod } from "@/contexts/PeriodContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getMediaPalette, MEDIA_OPTIONS } from "@/lib/mediaColors";

interface Campaign {
  id: string;
  media: string;
  topic: string;
  start_date: string;
  end_date: string;
  total_budget: number;
  image_url: string | null;
  landing_url: string | null;
  channel: string | null;
  impressions: number;
  clicks: number;
  conversions: number;
  note: string | null;
  status: string;
  created_by: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const fmtKRW = (n: number) =>
  n >= 10000 ? `${(n / 10000).toFixed(n >= 100000 ? 0 : 1)}만` : n.toLocaleString("ko-KR");

const isoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildMonthGrid = (year: number, month: number) => {
  // month: 1~12
  const first = new Date(year, month - 1, 1);
  const startDow = first.getDay(); // 0=일
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];
  // 앞 패딩
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month - 1, d), inMonth: true });
  }
  // 6주 그리드 채우기
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
    if (cells.length >= 42) break;
  }
  return cells;
};

const emptyForm = {
  media: "당근",
  topic: "",
  start_date: isoDate(new Date()),
  end_date: isoDate(new Date()),
  total_budget: "",
  image_url: "",
  landing_url: "",
  channel: "",
  impressions: "",
  clicks: "",
  conversions: "",
  note: "",
  status: "진행중",
};

export default function AdCalendarPage() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const { year, month, setYear, setMonth, setMode, mode, startDate, endDate, label: periodLabel } = usePeriod();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [salesByDate, setSalesByDate] = useState<Map<string, Map<string, number>>>(new Map());
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [openDetail, setOpenDetail] = useState<Campaign | null>(null);
  const [hoverPreview, setHoverPreview] = useState<{ url: string; topic: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // 필터: 매체 / 인입경로
  const [filterMedia, setFilterMedia] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");

  // 조회 범위: month 모드면 해당 월, day/range면 PeriodContext의 startDate/endDate 사용
  const monthStart = startDate;
  const monthEnd = endDate;
  // 캘린더 그리드는 항상 월 격자로 표기 → start 기준 연/월 사용
  const gridYear = useMemo(() => {
    if (mode === "month") return year;
    return new Date(startDate + "T00:00:00").getFullYear();
  }, [mode, year, startDate]);
  const activeMonth = useMemo(() => {
    if (mode === "month") return month === 0 ? new Date().getMonth() + 1 : month;
    return new Date(startDate + "T00:00:00").getMonth() + 1;
  }, [mode, month, startDate]);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: salesData }] = await Promise.all([
      supabase
        .from("ad_campaigns")
        .select("*")
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart)
        .order("start_date", { ascending: true }),
      supabase
        .from("sales")
        .select("open_date, channel, media:channel")
        .gte("open_date", monthStart)
        .lte("open_date", monthEnd),
    ]);
    if (error) toast.error("캠페인 불러오기 실패: " + error.message);
    else setCampaigns((data ?? []) as Campaign[]);

    // 날짜별 매체별 개통건수 (sales.channel을 매체로 사용)
    const map = new Map<string, Map<string, number>>();
    ((salesData as any[]) ?? []).forEach((s) => {
      if (!s.open_date) return;
      const dayMap = map.get(s.open_date) ?? new Map<string, number>();
      const ch = (s.channel as string) || "기타";
      dayMap.set(ch, (dayMap.get(ch) ?? 0) + 1);
      dayMap.set("__total__", (dayMap.get("__total__") ?? 0) + 1);
      map.set(s.open_date, dayMap);
    });
    setSalesByDate(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart, monthEnd]);

  const grid = useMemo(() => buildMonthGrid(gridYear, activeMonth), [gridYear, activeMonth]);

  // 필터 적용된 캠페인
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (filterMedia !== "all" && c.media !== filterMedia) return false;
      if (filterChannel !== "all" && (c.channel ?? "") !== filterChannel) return false;
      return true;
    });
  }, [campaigns, filterMedia, filterChannel]);

  const channelOptions = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((c) => c.channel && set.add(c.channel));
    return Array.from(set);
  }, [campaigns]);

  // 날짜 → 캠페인 매핑 (그 날짜에 진행 중인 모든 캠페인)
  const campaignsByDate = useMemo(() => {
    const map = new Map<string, Campaign[]>();
    for (const c of filteredCampaigns) {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      const cur = new Date(start);
      while (cur <= end) {
        const k = isoDate(cur);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(c);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [filteredCampaigns]);

  // 일자별 지출 = 캠페인 일할 계산 (총예산 ÷ 기간일수)
  const dailySpend = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filteredCampaigns) {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      const per = (c.total_budget || 0) / days;
      const cur = new Date(start);
      while (cur <= end) {
        const k = isoDate(cur);
        m.set(k, (m.get(k) ?? 0) + per);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [filteredCampaigns]);

  // 일자별 매체별 지출 세부 (툴팁용) — 같은 매체/캠페인 중복 합산 방지를 위해 캠페인 id 단위로 누적
  const dailySpendBreakdown = useMemo(() => {
    // key: date, value: Map<media, amount>
    const m = new Map<string, Map<string, number>>();
    const seen = new Set<string>(); // `${date}|${campaignId}` — 동일 캠페인이 같은 날짜에 두 번 더해지지 않도록 가드
    for (const c of filteredCampaigns) {
      const start = new Date(c.start_date);
      const end = new Date(c.end_date);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) continue;
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      const per = (c.total_budget || 0) / days;
      const cur = new Date(start);
      while (cur <= end) {
        const k = isoDate(cur);
        const guard = `${k}|${c.id}`;
        if (!seen.has(guard)) {
          seen.add(guard);
          const dayMap = m.get(k) ?? new Map<string, number>();
          dayMap.set(c.media, (dayMap.get(c.media) ?? 0) + per);
          m.set(k, dayMap);
        }
        cur.setDate(cur.getDate() + 1);
      }
    }
    return m;
  }, [filteredCampaigns]);

  // 월 일평균 지출
  const monthAvgDaily = useMemo(() => {
    const s = new Date(monthStart);
    const e = new Date(monthEnd);
    const days = Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
    return monthTotal / days;
  }, [monthStart, monthEnd, monthTotal === undefined ? 0 : monthTotal]);

  const monthTotal = useMemo(() => {
    let total = 0;
    for (const c of campaigns) {
      const start = new Date(Math.max(new Date(c.start_date).getTime(), new Date(monthStart).getTime()));
      const end = new Date(Math.min(new Date(c.end_date).getTime(), new Date(monthEnd).getTime()));
      const totalDays = Math.max(
        1,
        Math.round((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / 86400000) + 1,
      );
      const overlapDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
      total += ((c.total_budget || 0) / totalDays) * overlapDays;
    }
    return total;
  }, [campaigns, monthStart, monthEnd]);

  const onPrevMonth = () => {
    if (mode !== "month") setMode("month");
    if (activeMonth === 1) {
      setYear(gridYear - 1);
      setMonth(12);
    } else setMonth(activeMonth - 1);
  };
  const onNextMonth = () => {
    if (mode !== "month") setMode("month");
    if (activeMonth === 12) {
      setYear(gridYear + 1);
      setMonth(1);
    } else setMonth(activeMonth + 1);
  };

  const openCreate = (date?: string) => {
    if (!isAdmin) {
      toast.warning("관리자만 광고를 등록할 수 있습니다");
      return;
    }
    setEditingId(null);
    setForm({
      ...emptyForm,
      start_date: date ?? isoDate(new Date()),
      end_date: date ?? isoDate(new Date()),
    });
    setOpenForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm({
      media: c.media,
      topic: c.topic,
      start_date: c.start_date,
      end_date: c.end_date,
      total_budget: String(c.total_budget ?? ""),
      image_url: c.image_url ?? "",
      landing_url: c.landing_url ?? "",
      channel: c.channel ?? "",
      impressions: String(c.impressions ?? ""),
      clicks: String(c.clicks ?? ""),
      conversions: String(c.conversions ?? ""),
      note: c.note ?? "",
      status: c.status,
    });
    setOpenDetail(null);
    setOpenForm(true);
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("ad-creatives").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("이미지 업로드 실패: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("이미지가 업로드되었습니다");
  };

  const save = async () => {
    if (!user) return;
    if (!form.media || !form.topic || !form.start_date || !form.end_date) {
      toast.error("매체, 주제, 기간은 필수입니다");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("종료일은 시작일 이후여야 합니다");
      return;
    }
    const payload = {
      media: form.media,
      topic: form.topic,
      start_date: form.start_date,
      end_date: form.end_date,
      total_budget: Number(form.total_budget) || 0,
      image_url: form.image_url || null,
      landing_url: form.landing_url || null,
      channel: form.channel || null,
      impressions: Number(form.impressions) || 0,
      clicks: Number(form.clicks) || 0,
      conversions: Number(form.conversions) || 0,
      note: form.note || null,
      status: form.status,
    };
    if (editingId) {
      const { error } = await supabase.from("ad_campaigns").update(payload).eq("id", editingId);
      if (error) return toast.error("수정 실패: " + error.message);
      toast.success("광고 캠페인을 수정했습니다");
    } else {
      const { error } = await supabase.from("ad_campaigns").insert({ ...payload, created_by: user.id });
      if (error) return toast.error("등록 실패: " + error.message);
      toast.success("새 광고 캠페인을 등록했습니다");
    }
    setOpenForm(false);
    setForm(emptyForm);
    setEditingId(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("이 캠페인을 삭제할까요?")) return;
    const { error } = await supabase.from("ad_campaigns").delete().eq("id", id);
    if (error) return toast.error("삭제 실패: " + error.message);
    toast.success("캠페인이 삭제되었습니다");
    setOpenDetail(null);
    load();
  };

  const ctr = openDetail && openDetail.impressions > 0 ? ((openDetail.clicks / openDetail.impressions) * 100).toFixed(2) : "-";
  const cvr = openDetail && openDetail.clicks > 0 ? ((openDetail.conversions / openDetail.clicks) * 100).toFixed(2) : "-";
  const cpc = openDetail && openDetail.clicks > 0 ? Math.round(openDetail.total_budget / openDetail.clicks) : 0;
  const cpa = openDetail && openDetail.conversions > 0 ? Math.round(openDetail.total_budget / openDetail.conversions) : 0;

  return (
    <>
      <Header
        title="월별 광고 관리 캘린더"
        subtitle="매체별 광고 집행 일정과 성과를 한눈에 — 관리자만 등록할 수 있습니다"
        showScopeToggle={false}
        showPeriodFilter
        rightSlot={
          isAdmin && (
            <Button onClick={() => openCreate()} className="rounded-xl gap-2">
              <Plus className="size-4" /> 광고 등록
            </Button>
          )
        }
      />

      {/* 월 네비 + 요약 */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={onPrevMonth} className="size-9">
            <ChevronLeft className="size-4" />
          </Button>
          <div className="px-4 py-1.5 rounded-xl glass border border-border/40 text-base font-semibold tabular-nums flex flex-col items-center leading-tight">
            <span>{gridYear}년 {activeMonth}월</span>
            {mode !== "month" && (
              <span className="text-[10px] font-medium text-primary-glow/80">조회: {periodLabel}</span>
            )}
          </div>
          <Button variant="outline" size="icon" onClick={onNextMonth} className="size-9">
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* 필터 */}
          <div className="flex items-center gap-1.5">
            <Filter className="size-3.5 text-muted-foreground" />
            <Select value={filterMedia} onValueChange={setFilterMedia}>
              <SelectTrigger className="h-8 text-xs w-[110px]"><SelectValue placeholder="매체" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 매체</SelectItem>
                {MEDIA_OPTIONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="h-8 text-xs w-[120px]"><SelectValue placeholder="인입경로" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 경로</SelectItem>
                {channelOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {(filterMedia !== "all" || filterChannel !== "all") && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setFilterMedia("all"); setFilterChannel("all"); }}>
                <X className="size-3" /> 초기화
              </Button>
            )}
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">월 집행 합계 </span>
            <span className="font-bold text-revenue tabular-nums">₩{monthTotal.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="text-sm">
            <span className="text-muted-foreground">캠페인 </span>
            <span className="font-bold tabular-nums">{filteredCampaigns.length}개</span>
          </div>
          {/* 매체 범례 */}
          <div className="flex items-center gap-2 flex-wrap">
            {MEDIA_OPTIONS.map((m) => {
              const p = getMediaPalette(m);
              return (
                <span key={m} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className={cn("size-2 rounded-full", p.dot)} /> {m}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* 캘린더 그리드 */}
      <TooltipProvider delayDuration={200}>
      <Card className="glass-strong border-border/40 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/40">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className={cn(
                "px-3 py-2.5 text-xs font-semibold text-center",
                i === 0 ? "text-destructive/80" : i === 6 ? "text-primary-glow/80" : "text-muted-foreground",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          {grid.map((cell, idx) => {
            const key = isoDate(cell.date);
            const dayItems = campaignsByDate.get(key) ?? [];
            const isToday = isoDate(new Date()) === key;
            const spend = dailySpend.get(key) ?? 0;
            const dow = cell.date.getDay();
            return (
              <div
                key={idx}
                className={cn(
                  "min-h-[150px] border-b border-r border-border/30 p-2 group transition-colors flex flex-col",
                  !cell.inMonth && "bg-background/40 opacity-40",
                  cell.inMonth && "hover:bg-white/[0.02]",
                  isToday && "bg-primary/5 ring-1 ring-primary/30 ring-inset",
                  (idx + 1) % 7 === 0 && "border-r-0",
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    disabled={!cell.inMonth}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!cell.inMonth) return;
                      window.location.href = `/activities?date=${key}`;
                    }}
                    title="이 날짜의 실적 보기"
                    className={cn(
                      "text-sm font-bold tabular-nums hover:underline disabled:no-underline",
                      dow === 0 && "text-destructive/80",
                      dow === 6 && "text-primary-glow/80",
                      isToday && "px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground",
                    )}
                  >
                    {cell.date.getDate()}
                  </button>
                  {isAdmin && cell.inMonth && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openCreate(key);
                      }}
                      title="이 날짜에 광고 등록"
                      className="opacity-0 group-hover:opacity-100 transition size-5 rounded-md grid place-items-center text-muted-foreground hover:text-primary-glow hover:bg-primary/10"
                    >
                      <Plus className="size-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1 flex-1">
                  {dayItems.slice(0, 3).map((c) => {
                    const p = getMediaPalette(c.media);
                    const isStart = c.start_date === key;
                    const isEnd = c.end_date === key;
                    return (
                      <Tooltip key={c.id}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDetail(c);
                            }}
                            onMouseEnter={() => c.image_url && setHoverPreview({ url: c.image_url, topic: c.topic })}
                            onMouseLeave={() => setHoverPreview(null)}
                            className={cn(
                              "w-full text-left px-1.5 py-1 text-[10px] leading-tight border-l-[3px] rounded-sm",
                              p.bg,
                              p.border,
                              p.text,
                              "hover:brightness-125 transition",
                              isStart && "rounded-l-md",
                              isEnd && "rounded-r-md",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold truncate">{c.media}</span>
                              {c.image_url && <ImageIcon className="size-2.5 opacity-70 shrink-0" />}
                            </div>
                            <div className="truncate text-white/95 font-medium">{c.topic}</div>
                            <div className="tabular-nums font-semibold text-white/85">₩{fmtKRW(c.total_budget || 0)}</div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="space-y-0.5 text-xs">
                            <div className="font-semibold">{c.topic}</div>
                            <div className="text-muted-foreground">{c.media}{c.channel ? ` · ${c.channel}` : ""}</div>
                            <div className="text-muted-foreground">{c.start_date} ~ {c.end_date}</div>
                            <div className="tabular-nums">총 예산 ₩{(c.total_budget || 0).toLocaleString("ko-KR")}</div>
                            {c.note && <div className="text-muted-foreground line-clamp-3 mt-1">{c.note}</div>}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  {dayItems.length > 3 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="w-full text-[11px] font-bold text-[hsl(28_100%_70%)] hover:text-[hsl(28_100%_80%)] px-1.5 py-1 rounded-md bg-[hsl(28_95%_55%/0.15)] hover:bg-[hsl(28_95%_55%/0.25)] border border-[hsl(28_95%_55%/0.4)] text-left transition"
                        >
                          + {dayItems.length - 3}개 더보기
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80 p-3 max-h-96 overflow-y-auto glass-strong border-border/50 rounded-2xl shadow-card-elevated">
                        <div className="text-xs px-1 pb-2 font-semibold border-b border-border/30 mb-2 flex items-center justify-between">
                          <span className="text-foreground">📅 {key}</span>
                          <span className="text-muted-foreground tabular-nums">총 {dayItems.length}건</span>
                        </div>
                        <div className="space-y-1.5">
                          {dayItems.map((c) => {
                            const pp = getMediaPalette(c.media);
                            return (
                              <button
                                key={c.id}
                                onClick={(e) => { e.stopPropagation(); setOpenDetail(c); }}
                                className={cn(
                                  "w-full text-left px-2.5 py-2 rounded-lg border-l-[3px] text-xs",
                                  pp.bg, pp.border, pp.text,
                                  "hover:brightness-125 transition",
                                )}
                              >
                                <div className="font-bold flex items-center justify-between gap-2">
                                  <span>{c.media}</span>
                                  <span className="tabular-nums font-semibold text-white/90">₩{fmtKRW(c.total_budget || 0)}</span>
                                </div>
                                <div className="text-white/95 font-medium truncate mt-0.5">{c.topic}</div>
                              </button>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {(() => {
                  const dayMap = salesByDate.get(key);
                  const opens = dayMap?.get("__total__") ?? 0;
                  const cpa = opens > 0 && spend > 0 ? Math.round(spend / opens) : 0;
                  if (!cell.inMonth) return null;
                  const hasData = spend > 0 || opens > 0;
                  return (
                    <div className={cn(
                      "mt-auto pt-1.5 border-t border-border/30 grid grid-cols-3 gap-1 text-[10px] tabular-nums",
                      !hasData && "opacity-40"
                    )}>
                      <div className="text-center">
                        <div className="text-muted-foreground text-[9px]">지출</div>
                        <div className="font-bold text-foreground">
                          {spend > 0 ? `₩${fmtKRW(Math.round(spend))}` : "-"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-[9px]">개통</div>
                        <div className="font-bold text-emerald-300">
                          {opens > 0 ? `${opens}건` : "-"}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-muted-foreground text-[9px]">CPA</div>
                        <div className="font-bold text-[hsl(28_100%_72%)]">
                          {cpa > 0 ? `₩${fmtKRW(cpa)}` : "-"}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </Card>
      </TooltipProvider>

      {loading && (
        <div className="text-center py-6 text-sm text-muted-foreground">
          <Loader2 className="inline size-4 animate-spin mr-2" /> 불러오는 중…
        </div>
      )}

      {/* Hover 미리보기 */}
      {hoverPreview && (
        <div className="fixed bottom-6 right-6 z-50 glass-strong border border-border/40 rounded-2xl p-3 shadow-card-elevated max-w-[280px] pointer-events-none animate-in fade-in zoom-in-95">
          <img src={hoverPreview.url} alt={hoverPreview.topic} className="w-full h-48 object-cover rounded-lg" />
          <div className="mt-2 text-xs font-medium truncate">{hoverPreview.topic}</div>
        </div>
      )}

      {/* 상세 다이얼로그 */}
      <Dialog open={!!openDetail} onOpenChange={(o) => !o && setOpenDetail(null)}>
        <DialogContent className="max-w-2xl glass-strong border-border/40">
          {openDetail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", getMediaPalette(openDetail.media).dot)} />
                  <Badge variant="outline" className={cn(getMediaPalette(openDetail.media).text, getMediaPalette(openDetail.media).border)}>
                    {openDetail.media}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{openDetail.status}</Badge>
                </div>
                <DialogTitle className="text-xl">{openDetail.topic}</DialogTitle>
                <DialogDescription>
                  {openDetail.start_date} ~ {openDetail.end_date} · 총 예산 ₩{(openDetail.total_budget || 0).toLocaleString("ko-KR")}
                </DialogDescription>
              </DialogHeader>

              {openDetail.image_url && (
                <a href={openDetail.image_url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={openDetail.image_url}
                    alt={openDetail.topic}
                    className="w-full max-h-80 object-contain rounded-xl bg-black/30 border border-border/40"
                  />
                </a>
              )}

              {/* KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass rounded-xl p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Eye className="size-3" /> 노출</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{openDetail.impressions.toLocaleString("ko-KR")}</div>
                </div>
                <div className="glass rounded-xl p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><MousePointerClick className="size-3" /> 클릭</div>
                  <div className="mt-1 text-lg font-bold tabular-nums">{openDetail.clicks.toLocaleString("ko-KR")}</div>
                  <div className="text-[10px] text-muted-foreground">CTR {ctr}%</div>
                </div>
                <div className="glass rounded-xl p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Target className="size-3" /> 인입(전환)</div>
                  <div className="mt-1 text-lg font-bold tabular-nums text-success">{openDetail.conversions.toLocaleString("ko-KR")}</div>
                  <div className="text-[10px] text-muted-foreground">CVR {cvr}%</div>
                </div>
                <div className="glass rounded-xl p-3 border border-border/40">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><TrendingUp className="size-3" /> 효율</div>
                  <div className="mt-1 text-xs tabular-nums">CPC ₩{cpc.toLocaleString("ko-KR")}</div>
                  <div className="text-xs tabular-nums">CPA ₩{cpa.toLocaleString("ko-KR")}</div>
                </div>
              </div>

              {openDetail.note && (
                <div className="text-sm text-muted-foreground bg-white/[0.02] border border-border/30 rounded-xl p-3 whitespace-pre-wrap">
                  {openDetail.note}
                </div>
              )}

              <DialogFooter className="gap-2">
                {openDetail.landing_url && (
                  <a
                    href={openDetail.landing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-glow hover:underline mr-auto"
                  >
                    랜딩 URL 열기 →
                  </a>
                )}
                {isAdmin && (
                  <>
                    <Button variant="outline" onClick={() => openEdit(openDetail)} className="gap-1.5">
                      <Pencil className="size-3.5" /> 수정
                    </Button>
                    <Button variant="destructive" onClick={() => remove(openDetail.id)} className="gap-1.5">
                      <Trash2 className="size-3.5" /> 삭제
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 등록/수정 폼 */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="max-w-2xl glass-strong border-border/40 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "광고 캠페인 수정" : "새 광고 캠페인 등록"}</DialogTitle>
            <DialogDescription>매체별로 색상이 자동 지정되며 캘린더에 막대로 표시됩니다</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>매체 *</Label>
              <Select value={form.media} onValueChange={(v) => setForm((f) => ({ ...f, media: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MEDIA_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>인입경로</Label>
              <Input
                value={form.channel}
                onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                placeholder="예: 당근지면, 메타피드"
                className="mt-1.5"
              />
            </div>
            <div className="md:col-span-2">
              <Label>광고 주제 *</Label>
              <Input
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                placeholder="예: 11월 갤럭시 S24 0원 프로모션"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>시작일 *</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label>종료일 *</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1.5" />
            </div>
            <div>
              <Label>총 광고비 (₩)</Label>
              <Input
                type="number"
                value={form.total_budget}
                onChange={(e) => setForm((f) => ({ ...f, total_budget: e.target.value }))}
                placeholder="0"
                className="mt-1.5 tabular-nums"
              />
            </div>
            <div>
              <Label>상태</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["진행중", "예정", "완료", "중단"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 이미지 */}
            <div className="md:col-span-2">
              <Label>광고 소재 이미지</Label>
              <div className="mt-1.5 flex flex-col md:flex-row gap-3 items-start">
                <div className="flex-1 w-full">
                  <Input
                    value={form.image_url}
                    onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="이미지 URL을 붙여넣거나 우측에서 업로드"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="gap-1.5"
                    >
                      {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                      업로드
                    </Button>
                    {form.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                        className="gap-1.5 text-muted-foreground"
                      >
                        <X className="size-3.5" /> 제거
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.target.value = "";
                    }}
                  />
                </div>
                {form.image_url && (
                  <img
                    src={form.image_url}
                    alt="미리보기"
                    className="w-32 h-32 object-cover rounded-lg border border-border/40 bg-black/30"
                  />
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <Label>랜딩 URL</Label>
              <Input
                value={form.landing_url}
                onChange={(e) => setForm((f) => ({ ...f, landing_url: e.target.value }))}
                placeholder="https://..."
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>노출수</Label>
              <Input type="number" value={form.impressions} onChange={(e) => setForm((f) => ({ ...f, impressions: e.target.value }))} className="mt-1.5 tabular-nums" />
            </div>
            <div>
              <Label>클릭수</Label>
              <Input type="number" value={form.clicks} onChange={(e) => setForm((f) => ({ ...f, clicks: e.target.value }))} className="mt-1.5 tabular-nums" />
            </div>
            <div className="md:col-span-2">
              <Label>인입(전환)건수</Label>
              <Input type="number" value={form.conversions} onChange={(e) => setForm((f) => ({ ...f, conversions: e.target.value }))} className="mt-1.5 tabular-nums" />
            </div>

            <div className="md:col-span-2">
              <Label>메모</Label>
              <Textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} className="mt-1.5" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpenForm(false)}>취소</Button>
            <Button onClick={save}>{editingId ? "수정 저장" : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
