import { useEffect, useMemo, useState } from "react";
import {
  format, startOfWeek, startOfMonth, startOfDay, subDays, addDays,
} from "date-fns";
import {
  CalendarIcon, Plus, Search, Trash2, Pencil, X, Download, RotateCcw,
  Crown, Trophy, Medal, TrendingUp, BarChart3, Users, Flame, ArrowDown, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDashboardStaff } from "@/hooks/useDashboardStaff";
import { useStaffNames } from "@/hooks/useStaffNames";
import { cn } from "@/lib/utils";
import { exportToExcel, type ColumnDef } from "@/lib/excelExport";
import { toast } from "sonner";

type Row = {
  id: string;
  change_date: string;
  manager: string | null;
  customer_join_number: string | null;
  customer_name: string | null;
  prev_fee: number;
  prev_select_discount: boolean;
  new_fee: number;
  new_select_discount: boolean;
  pure_upsell: number;
  final_upsell: number;
  offer_provided: boolean;
  note: string | null;
  created_by: string;
};

const todayStr = () => format(new Date(), "yyyy-MM-dd");
const won = (n: number) => `${Math.round(n).toLocaleString()}원`;
const onlyDigits = (s: string, max: number) => s.replace(/[^0-9]/g, "").slice(0, max);
const calcDiscounted = (fee: number, on: boolean) => (on ? fee * 0.75 : fee);

export default function CustomProposalsPage() {
  const { user } = useAuth();
  const { staff } = useDashboardStaff();
  const { resolve: resolveName } = useStaffNames();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [rankPeriod, setRankPeriod] = useState<"month" | "all">("month");

  // form state
  const [editId, setEditId] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [manager, setManager] = useState<string>("");
  const [joinNumber, setJoinNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [prevFee, setPrevFee] = useState("");
  const [prevDiscount, setPrevDiscount] = useState(false);
  const [newFee, setNewFee] = useState("");
  const [newDiscount, setNewDiscount] = useState(false);
  const [offerProvided, setOfferProvided] = useState(false);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  // 기본 담당자 = 로그인 사용자 이름
  useEffect(() => {
    if (manager || !user) return;
    const me = staff.find((s) => s.user_id === user.id);
    if (me?.display_name) setManager(me.display_name);
  }, [user, staff, manager]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("custom_proposals")
      .select("*")
      .order("change_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) {
      toast.error("목록을 불러오지 못했어요");
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const prevFeeN = Number(prevFee || 0);
  const newFeeN = Number(newFee || 0);
  const prevFinal = calcDiscounted(prevFeeN, prevDiscount);
  const newFinal = calcDiscounted(newFeeN, newDiscount);
  const pureUpsell = newFeeN - prevFeeN;
  const finalUpsell = newFinal - prevFinal;

  const resetForm = () => {
    setEditId(null);
    setDate(new Date());
    setJoinNumber("");
    setCustomerName("");
    setPrevFee("");
    setPrevDiscount(false);
    setNewFee("");
    setNewDiscount(false);
    setOfferProvided(false);
    setMemo("");
  };

  const save = async () => {
    if (!user) return;
    if (!customerName.trim()) {
      toast.error("고객명을 입력해주세요");
      return;
    }
    setSaving(true);
    const payload = {
      change_date: format(date, "yyyy-MM-dd"),
      manager: manager || null,
      customer_join_number: joinNumber || null,
      customer_name: customerName.trim(),
      prev_fee: prevFeeN,
      prev_select_discount: prevDiscount,
      new_fee: newFeeN,
      new_select_discount: newDiscount,
      pure_upsell: pureUpsell,
      final_upsell: finalUpsell,
      offer_provided: offerProvided,
      note: memo.trim() || null,
    };
    const { error } = editId
      ? await supabase.from("custom_proposals").update(payload).eq("id", editId)
      : await supabase.from("custom_proposals").insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) {
      toast.error(`저장 실패: ${error.message}`);
      return;
    }
    toast.success(editId ? "수정되었습니다" : "등록되었습니다");
    resetForm();
    refresh();
  };

  const edit = (r: Row) => {
    setEditId(r.id);
    setDate(new Date(r.change_date));
    setManager(r.manager ?? "");
    setJoinNumber(r.customer_join_number ?? "");
    setCustomerName(r.customer_name ?? "");
    setPrevFee(String(r.prev_fee ?? ""));
    setPrevDiscount(!!r.prev_select_discount);
    setNewFee(String(r.new_fee ?? ""));
    setNewDiscount(!!r.new_select_discount);
    setOfferProvided(!!r.offer_provided);
    setMemo(r.note ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: string) => {
    if (!confirm("이 항목을 삭제할까요?")) return;
    const { error } = await supabase.from("custom_proposals").delete().eq("id", id);
    if (error) toast.error(`삭제 실패: ${error.message}`);
    else {
      toast.success("삭제되었습니다");
      refresh();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromStr = dateFrom ? format(dateFrom, "yyyy-MM-dd") : null;
    const toStr = dateTo ? format(dateTo, "yyyy-MM-dd") : null;
    return rows.filter((r) => {
      if (fromStr && r.change_date < fromStr) return false;
      if (toStr && r.change_date > toStr) return false;
      if (!q) return true;
      const m = (r.manager ?? "").toLowerCase();
      const c = (r.customer_name ?? "").toLowerCase();
      const j = (r.customer_join_number ?? "").toLowerCase();
      return m.includes(q) || c.includes(q) || j.includes(q);
    });
  }, [rows, search, dateFrom, dateTo]);

  const resetDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const proposalExportColumns: ColumnDef[] = [
    ["change_date", "변경일"],
    ["manager", "담당자", (r: Row) => resolveName(r.manager, r.manager ?? "-")],
    ["customer_name", "고객명"],
    ["customer_join_number", "가입번호"],
    ["prev_fee", "기존요금"],
    ["prev_select_discount", "기존선약여부", (r: Row) => (r.prev_select_discount ? "선약" : "일반")],
    ["new_fee", "변경요금"],
    ["new_select_discount", "변경선약여부", (r: Row) => (r.new_select_discount ? "선약" : "일반")],
    ["pure_upsell", "순수업셀"],
    ["final_upsell", "최종업셀"],
    ["offer_provided", "오퍼여부", (r: Row) => (r.offer_provided ? "오퍼 제공" : "미제공")],
    ["note", "상담메모"],
  ];

  const handleExport = () => {
    exportToExcel(filtered, proposalExportColumns, "맞춤제안실적", "맞춤제안실적");
  };

  /* ───────────── 대시보드 집계 (검색/기간 필터와 무관하게 전체 rows 기준) ───────────── */
  const dashboard = useMemo(() => {
    const today = startOfDay(new Date());
    const todayStr2 = format(today, "yyyy-MM-dd");
    const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const last30Start = format(subDays(today, 29), "yyyy-MM-dd");

    const todayCount = rows.filter((r) => r.change_date === todayStr2).length;
    const weekCount = rows.filter((r) => r.change_date >= weekStart).length;
    const monthRows = rows.filter((r) => r.change_date >= monthStart);
    const monthCount = monthRows.length;
    const monthUpsell = monthRows.reduce((s, r) => s + (r.final_upsell || 0), 0);
    const last30Count = rows.filter((r) => r.change_date >= last30Start).length;
    const dailyAvg = Math.round((last30Count / 30) * 10) / 10;

    // 최근 8주 추이 (월요일 시작)
    const weeklyTrend: { label: string; count: number; upsell: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const wStart = startOfWeek(subDays(today, i * 7), { weekStartsOn: 1 });
      const wEnd = addDays(wStart, 6);
      const wStartStr = format(wStart, "yyyy-MM-dd");
      const wEndStr = format(wEnd, "yyyy-MM-dd");
      const inWeek = rows.filter((r) => r.change_date >= wStartStr && r.change_date <= wEndStr);
      weeklyTrend.push({
        label: format(wStart, "MM/dd"),
        count: inWeek.length,
        upsell: inWeek.reduce((s, r) => s + (r.final_upsell || 0), 0),
      });
    }

    // 추이 모멘텀 (게임 랭크식 연속 상승/하락 스트릭)
    let momentumDir: "up" | "down" | "flat" = "flat";
    let momentumStreak = 0;
    for (let i = weeklyTrend.length - 1; i > 0; i--) {
      const diff = weeklyTrend[i].count - weeklyTrend[i - 1].count;
      const dir: "up" | "down" | "flat" = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
      if (i === weeklyTrend.length - 1) {
        momentumDir = dir;
        if (dir !== "flat") momentumStreak = 1;
      } else if (dir === momentumDir && dir !== "flat") {
        momentumStreak += 1;
      } else {
        break;
      }
    }
    const thisWeekCount = weeklyTrend[weeklyTrend.length - 1].count;
    const lastWeekCount = weeklyTrend[weeklyTrend.length - 2].count;
    const weekDelta = thisWeekCount - lastWeekCount;
    const peakWeek = weeklyTrend.reduce((max, w) => (w.count > max.count ? w : max), weeklyTrend[0]);

    // 담당자 랭킹
    const rankSourceRows = rankPeriod === "month" ? monthRows : rows;
    const mgrMap = new Map<string, { count: number; upsell: number }>();
    rankSourceRows.forEach((r) => {
      const name = resolveName(r.manager, r.manager ?? "미지정");
      const cur = mgrMap.get(name) ?? { count: 0, upsell: 0 };
      cur.count += 1;
      cur.upsell += r.final_upsell || 0;
      mgrMap.set(name, cur);
    });
    const managerRanking = Array.from(mgrMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.upsell - a.upsell);

    return {
      todayCount, weekCount, monthCount, monthUpsell, dailyAvg,
      weeklyTrend, momentumDir, momentumStreak, weekDelta, peakWeek, managerRanking,
    };
  }, [rows, rankPeriod, resolveName]);

  const rankMedalStyle = [
    { wrap: "bg-gradient-to-br from-amber-100 to-orange-100 ring-1 ring-amber-400", icon: Crown, color: "text-amber-700" },
    { wrap: "bg-gradient-to-br from-slate-200 to-slate-100 ring-1 ring-slate-400", icon: Trophy, color: "text-slate-600" },
    { wrap: "bg-gradient-to-br from-orange-100 to-amber-50 ring-1 ring-orange-400", icon: Medal, color: "text-orange-700" },
  ];

  const DashboardTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as { label: string; count: number; upsell: number };
    return (
      <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
        <div className="font-medium mb-0.5">{d.label}</div>
        <div className="text-muted-foreground">{d.count}건 · {won(d.upsell)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Header title="맞춤제안 실적관리" subtitle="요금제 변경 업셀 실시간 계산 · 누적 실적 관리" />

      {/* 대시보드 */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <div className="text-sm font-semibold">맞춤제안 실적 대시보드</div>
        </div>

        {/* KPI 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">오늘 건수</div>
            <div className="text-xl font-bold mt-1">{dashboard.todayCount}건</div>
          </Card>
          <Card className="p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">이번주 건수</div>
            <div className="text-xl font-bold mt-1">{dashboard.weekCount}건</div>
          </Card>
          <Card className="p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">일평균(최근 30일)</div>
            <div className="text-xl font-bold mt-1">{dashboard.dailyAvg}건</div>
          </Card>
          <Card className="p-3 border-primary/30 bg-primary/5">
            <div className="text-xs text-muted-foreground">이번달 누적 업셀</div>
            <div className="text-xl font-bold mt-1 text-primary">{won(dashboard.monthUpsell)}</div>
          </Card>
        </div>

        {/* 추이 흐름 */}
        <Card className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-muted-foreground" />
              <div className="text-xs font-semibold text-muted-foreground">최근 8주 추이</div>
            </div>

            {/* 모멘텀 배지 (게임 랭크식 연속 상승/하락 표시) */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
              dashboard.momentumDir === "up" && dashboard.momentumStreak >= 2
                ? "bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-glow"
                : dashboard.momentumDir === "down" && dashboard.momentumStreak >= 2
                ? "bg-muted text-muted-foreground"
                : "bg-muted/60 text-muted-foreground",
            )}>
              {dashboard.momentumDir === "up" && dashboard.momentumStreak >= 2 ? (
                <>
                  <Flame className="size-3.5" />
                  {dashboard.momentumStreak}주 연속 상승세
                </>
              ) : dashboard.momentumDir === "down" && dashboard.momentumStreak >= 2 ? (
                <>
                  <ArrowDown className="size-3.5" />
                  {dashboard.momentumStreak}주 연속 하락세
                </>
              ) : (
                <>
                  <Minus className="size-3.5" />
                  보합
                </>
              )}
              <span className="opacity-80 font-medium">
                · 전주 대비 {dashboard.weekDelta > 0 ? "+" : ""}{dashboard.weekDelta}건
              </span>
            </div>
          </div>

          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.weeklyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<DashboardTooltip />} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#trendFlow)"
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[10px] text-muted-foreground mt-2">
            최고 기록: {dashboard.peakWeek.label} 주 {dashboard.peakWeek.count}건
          </div>
        </Card>

        {/* 담당자 랭킹 */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Users className="size-3.5 text-muted-foreground" />
              <div className="text-xs font-semibold text-muted-foreground">담당자 랭킹 (최종업셀 합계 기준)</div>
            </div>
            <div className="flex p-1 rounded-lg bg-muted/60 text-xs">
              {([["month", "이번달"], ["all", "전체기간"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setRankPeriod(key)}
                  className={cn(
                    "px-3 py-1 rounded-md font-medium transition-all",
                    rankPeriod === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {dashboard.managerRanking.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">집계할 데이터가 없습니다</div>
          ) : (
            <>
              {/* Top 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                {dashboard.managerRanking.slice(0, 3).map((r, i) => {
                  const S = rankMedalStyle[i];
                  const Icon = S.icon;
                  return (
                    <div key={r.name} className={cn("rounded-xl p-3", S.wrap)}>
                      <div className="flex items-center justify-between">
                        <Icon className={cn("size-4", S.color)} />
                        <span className={cn("text-[10px] font-bold", S.color)}>#{i + 1}</span>
                      </div>
                      <div className="mt-2 text-sm font-semibold truncate">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.count}건</div>
                      <div className="mt-1 text-base font-bold">{won(r.upsell)}</div>
                    </div>
                  );
                })}
              </div>

              {/* 4위 이하 */}
              {dashboard.managerRanking.length > 3 && (
                <ul className="space-y-1">
                  {dashboard.managerRanking.slice(3).map((r, i) => (
                    <li key={r.name} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors text-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 4}</span>
                        <span className="font-medium">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground">{r.count}건</span>
                      </div>
                      <span className="font-semibold tabular-nums">{won(r.upsell)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </Card>

      {/* 입력 폼 */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">
            {editId ? "맞춤제안 수정" : "신규 맞춤제안 등록"}
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors",
              offerProvided ? "border-primary/40 bg-primary/10" : "border-border bg-muted/40",
            )}>
              <span className={cn(
                "text-xs font-semibold",
                offerProvided ? "text-primary" : "text-muted-foreground",
              )}>
                {offerProvided ? "오퍼 제공" : "오퍼 미제공"}
              </span>
              <Switch checked={offerProvided} onCheckedChange={setOfferProvided} />
            </div>
            {editId && (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                <X className="size-4 mr-1" /> 수정 취소
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-2">
            <Label>변경일</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {date ? format(date, "yyyy-MM-dd") : "날짜 선택"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>담당자</Label>
            <Select value={manager || undefined} onValueChange={(v) => setManager(v)}>
              <SelectTrigger>
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.user_id} value={s.display_name}>
                    {s.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>고객가입번호 (숫자 최대 12자리)</Label>
            <Input
              inputMode="numeric"
              value={joinNumber}
              onChange={(e) => setJoinNumber(onlyDigits(e.target.value, 12))}
              placeholder="예: 123456789012"
            />
          </div>

          <div className="space-y-2">
            <Label>고객명</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="고객명"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* 기존 요금제 */}
          <Card className="p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">기존 요금제</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">선택약정</span>
                <Switch checked={prevDiscount} onCheckedChange={setPrevDiscount} />
                <Badge variant={prevDiscount ? "default" : "secondary"} className="text-[10px]">
                  {prevDiscount ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
            <Input
              inputMode="numeric"
              value={prevFee}
              onChange={(e) => setPrevFee(onlyDigits(e.target.value, 10))}
              placeholder="예: 44000"
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>원 요금</span>
              <span className="font-medium text-foreground">{won(prevFeeN)}</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>선약 반영</span>
              <span className={cn("font-semibold", prevDiscount && "text-primary")}>
                {won(prevFinal)}
              </span>
            </div>
          </Card>

          {/* 변경 요금제 */}
          <Card className="p-3 space-y-2 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">변경 요금제</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">선택약정</span>
                <Switch checked={newDiscount} onCheckedChange={setNewDiscount} />
                <Badge variant={newDiscount ? "default" : "secondary"} className="text-[10px]">
                  {newDiscount ? "ON" : "OFF"}
                </Badge>
              </div>
            </div>
            <Input
              inputMode="numeric"
              value={newFee}
              onChange={(e) => setNewFee(onlyDigits(e.target.value, 10))}
              placeholder="예: 55000"
            />
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>원 요금</span>
              <span className="font-medium text-foreground">{won(newFeeN)}</span>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>선약 반영</span>
              <span className={cn("font-semibold", newDiscount && "text-primary")}>
                {won(newFinal)}
              </span>
            </div>
          </Card>
        </div>

        {/* 실시간 업셀 결과 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="text-xs text-muted-foreground">순수 요금 업셀 금액</div>
            <div className="text-xs text-muted-foreground mt-0.5">(변경 요금 − 기존 요금)</div>
            <div className={cn(
              "mt-2 text-2xl font-bold",
              pureUpsell > 0 ? "text-primary" : pureUpsell < 0 ? "text-destructive" : "",
            )}>
              {pureUpsell > 0 ? "+" : ""}{won(pureUpsell)}
            </div>
          </Card>
          <Card className="p-4 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
            <div className="text-xs text-muted-foreground">선약 반영 최종 업셀 금액</div>
            <div className="text-xs text-muted-foreground mt-0.5">(신규 최종 − 기존 최종)</div>
            <div className={cn(
              "mt-2 text-2xl font-bold",
              finalUpsell > 0 ? "text-primary" : finalUpsell < 0 ? "text-destructive" : "",
            )}>
              {finalUpsell > 0 ? "+" : ""}{won(finalUpsell)}
            </div>
          </Card>
        </div>

        {/* 상담 메모 */}
        <div className="space-y-1.5">
          <Label className="text-xs">상담 메모</Label>
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="고객 반응 및 상담 특이사항을 자유롭게 기록하세요."
            rows={3}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Plus className="size-4 mr-1" />
            {editId ? "수정 저장" : "등록"}
          </Button>
        </div>
      </Card>

      {/* 리스트 */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">맞춤제안 실적 리스트</div>
          <div className="flex items-center gap-2 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateFrom ? format(dateFrom, "yyyy-MM-dd") : "시작일"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={(d) => setDateFrom(d ?? undefined)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">~</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 size-4" />
                  {dateTo ? format(dateTo, "yyyy-MM-dd") : "종료일"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={(d) => setDateTo(d ?? undefined)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="icon" onClick={resetDateFilter} title="기간 필터 초기화">
                <RotateCcw className="size-4" />
              </Button>
            )}

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="고객명 · 담당자 · 고객가입번호 검색"
                className="pl-9"
              />
            </div>

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-1" />
              엑셀 다운로드
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>변경일</TableHead>
                <TableHead>담당자</TableHead>
                <TableHead>고객명</TableHead>
                <TableHead>가입번호</TableHead>
                <TableHead className="text-right">기존요금(선약)</TableHead>
                <TableHead className="text-right">변경요금(선약)</TableHead>
                <TableHead className="text-right">순수업셀</TableHead>
                <TableHead className="text-right">최종업셀</TableHead>
                <TableHead className="text-center">오퍼여부</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">불러오는 중…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">등록된 맞춤제안이 없습니다</TableCell></TableRow>
              ) : filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{r.change_date}</TableCell>
                  <TableCell className="whitespace-nowrap">{resolveName(r.manager, r.manager ?? "-")}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.customer_name ?? "-"}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{r.customer_join_number ?? "-"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {won(r.prev_fee)}{" "}
                    <Badge variant={r.prev_select_discount ? "default" : "secondary"} className="text-[9px] ml-1">
                      {r.prev_select_discount ? "선약" : "일반"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {won(r.new_fee)}{" "}
                    <Badge variant={r.new_select_discount ? "default" : "secondary"} className="text-[9px] ml-1">
                      {r.new_select_discount ? "선약" : "일반"}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-right whitespace-nowrap font-semibold",
                    r.pure_upsell > 0 ? "text-primary" : r.pure_upsell < 0 ? "text-destructive" : "")}>
                    {r.pure_upsell > 0 ? "+" : ""}{won(r.pure_upsell)}
                  </TableCell>
                  <TableCell className={cn("text-right whitespace-nowrap font-semibold",
                    r.final_upsell > 0 ? "text-primary" : r.final_upsell < 0 ? "text-destructive" : "")}>
                    {r.final_upsell > 0 ? "+" : ""}{won(r.final_upsell)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.offer_provided ? "default" : "secondary"} className="text-[9px]">
                      {r.offer_provided ? "오퍼 제공" : "미제공"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => edit(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}0
