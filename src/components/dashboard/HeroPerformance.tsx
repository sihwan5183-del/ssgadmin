import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sun, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, Smartphone, Monitor, Package, Wifi, Tv, Home, Star, CreditCard, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Segment = "all" | "모바일" | "USIM MNP" | "2nd" | "홈" | "TV프리" | "스마트홈" | "대명" | "맞춤제안" | "기타";

const PRODUCT_BADGES: { key: Segment; label: string; short: string; icon: typeof Smartphone; color: string }[] = [
  { key: "all", label: "전체", short: "전체", icon: Package, color: "text-foreground" },
  { key: "모바일", label: "모바일", short: "M", icon: Smartphone, color: "text-primary" },
  { key: "USIM MNP", label: "USIM", short: "U", icon: CreditCard, color: "text-chart-1" },
  { key: "2nd", label: "2nd", short: "2", icon: Smartphone, color: "text-chart-2" },
  { key: "홈", label: "홈", short: "H", icon: Wifi, color: "text-chart-3" },
  { key: "TV프리", label: "TV프리", short: "TV", icon: Tv, color: "text-chart-4" },
  { key: "스마트홈", label: "스마트홈", short: "SH", icon: Home, color: "text-chart-5" },
  { key: "대명", label: "대명", short: "DM", icon: Star, color: "text-warning" },
  { key: "맞춤제안", label: "업셀", short: "UP", icon: Lightbulb, color: "text-success" },
  { key: "기타", label: "기타", short: "E", icon: Package, color: "text-muted-foreground" },
];

const classifyProduct = (p: string | null): Segment => {
  if (!p) return "기타";
  if (p.includes("모바일")) return "모바일";
  if (p === "USIM MNP" || p.includes("USIM")) return "USIM MNP";
  if (p === "세컨" || p === "2nd" || p.includes("세컨")) return "2nd";
  if (p === "홈" || p.includes("인터넷")) return "홈";
  if (p.includes("TV프리") || p.includes("TV")) return "TV프리";
  if (p.includes("스마트홈") || p.includes("IOT")) return "스마트홈";
  if (p.includes("대명")) return "대명";
  if (p.includes("맞춤") || p.includes("업셀")) return "맞춤제안";
  return "기타";
};

const matchSegment = (product: string | null, seg: Segment) => {
  if (seg === "all") return true;
  return classifyProduct(product) === seg;
};

const PENDING_ACTIVATION_STATUS_OR =
  "status.eq.청약완료,status.eq.택배발송,status.ilike.청약*완료,status.ilike.택배*발송";
const normalizeStatusValue = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, "").trim();
const isPendingActivationStatus = (value: string | null | undefined) =>
  normalizeStatusValue(value) === "청약완료" || normalizeStatusValue(value) === "택배발송";

type SegMap = Record<Segment, number>;
const countAll = (rows: { product: string | null }[]): SegMap => {
  const m: SegMap = { all: 0, "모바일": 0, "USIM MNP": 0, "2nd": 0, "홈": 0, "TV프리": 0, "스마트홈": 0, "대명": 0, "맞춤제안": 0, "기타": 0 };
  rows.forEach((r) => { const k = classifyProduct(r.product); m[k]++; m.all++; });
  return m;
};

const SegBadges = ({ counts, onSelect, active }: { counts: SegMap; onSelect: (s: Segment) => void; active: Segment }) => {
  const items = PRODUCT_BADGES.filter((b) => b.key !== "all" && counts[b.key] > 0);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {items.map((b) => (
        <button
          key={b.key}
          onClick={(e) => { e.stopPropagation(); onSelect(active === b.key ? "all" : b.key); }}
          className={cn(
            "inline-flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded border transition-all",
            active === b.key
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-muted/40 border-transparent hover:border-border",
            b.color
          )}
          title={b.label}
        >
          <b.icon className="size-2" />
          {b.short}:{counts[b.key]}
        </button>
      ))}
    </div>
  );
};

const Delta = ({ value, label }: { value: number; label: string }) => {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
          positive
            ? "text-success bg-success/10 border border-success/20"
            : "text-destructive bg-destructive/10 border border-destructive/20"
        )}
      >
        <Icon className="size-2.5" />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
};

export const HeroPerformance = () => {
  const { startDate, endDate, prevStartDate, prevEndDate, label, month } = usePeriod();
  const { settings } = useAppSettings();
  const monthlyTarget = Number(settings?.monthly_target ?? 100);

  const [segment, setSegment] = useState<Segment>("all");
  const [todayRows, setTodayRows] = useState<{ product: string | null }[]>([]);
  const [ydayRows, setYdayRows] = useState<{ product: string | null }[]>([]);
  const [currentRows, setCurrentRows] = useState<{ product: string | null }[]>([]);
  const [prevRows, setPrevRows] = useState<{ product: string | null }[]>([]);
  const [pendingRows, setPendingRows] = useState<{ product: string | null; created_at: string; open_date: string | null; status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const todayISO = new Date().toISOString().slice(0, 10);
      const ydate = new Date();
      ydate.setDate(ydate.getDate() - 1);
      const ydayISO = ydate.toISOString().slice(0, 10);

      const [a, b, c, d, e] = await Promise.all([
        supabase.from("sales").select("product").gte("open_date", startDate).lte("open_date", endDate).in("status", ["개통완료", "설치완료"]).limit(10000),
        supabase.from("sales").select("product").gte("open_date", prevStartDate).lte("open_date", prevEndDate).in("status", ["개통완료", "설치완료"]).limit(10000),
        supabase.from("sales").select("product").eq("open_date", todayISO).in("status", ["개통완료", "설치완료"]).limit(5000),
        supabase.from("sales").select("product").eq("open_date", ydayISO).in("status", ["개통완료", "설치완료"]).limit(5000),
        supabase.from("sales").select("product, created_at, open_date, status")
          .or(PENDING_ACTIVATION_STATUS_OR)
          .or(`and(open_date.gte.${startDate},open_date.lte.${endDate}),and(open_date.is.null,created_at.gte.${startDate}T00:00:00,created_at.lte.${endDate}T23:59:59.999)`)
          .limit(5000),
      ]);
      if (!alive) return;
      setCurrentRows(a.data ?? []);
      setPrevRows(b.data ?? []);
      setTodayRows(c.data ?? []);
      setYdayRows(d.data ?? []);
      setPendingRows((e.data ?? []).filter((row) => isPendingActivationStatus(row.status)));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate, prevStartDate, prevEndDate]);

  const filtered = useMemo(() => {
    const cur = currentRows.filter((r) => matchSegment(r.product, segment));
    const prev = prevRows.filter((r) => matchSegment(r.product, segment));
    const tod = todayRows.filter((r) => matchSegment(r.product, segment));
    const yd = ydayRows.filter((r) => matchSegment(r.product, segment));
    const pend = pendingRows.filter((r) => matchSegment(r.product, segment));
    const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
    const urgent = pend.filter((r) => new Date(r.created_at).getTime() <= threeHoursAgo);
    return { cur: cur.length, prev: prev.length, tod: tod.length, yd: yd.length, pend: pend.length, urgent: urgent.length };
  }, [segment, currentRows, prevRows, todayRows, ydayRows, pendingRows]);

  const todaySeg = useMemo(() => countAll(todayRows), [todayRows]);
  const pendSeg = useMemo(() => countAll(pendingRows), [pendingRows]);
  const curSeg = useMemo(() => countAll(currentRows), [currentRows]);

  const periodDelta = filtered.prev === 0 ? (filtered.cur > 0 ? 100 : 0) : ((filtered.cur - filtered.prev) / filtered.prev) * 100;
  const todayDelta = filtered.yd === 0 ? (filtered.tod > 0 ? 100 : 0) : ((filtered.tod - filtered.yd) / filtered.yd) * 100;
  const prevLabel = month === 0 ? "전년 대비" : "전월 대비";
  const hasPending = filtered.pend > 0;

  return (
    <section className="h-full flex flex-col gap-1.5">
      {/* Segment tabs */}
      <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5 w-fit flex-wrap">
        {PRODUCT_BADGES.map((s) => {
          const isActive = segment === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={cn(
                "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <s.icon className="size-3" />
              {s.short === s.label ? s.label : s.label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 flex-1">
        {/* 오늘의 개통 */}
        <Card className="p-2.5 glass relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Sun className="size-3 text-warning" />
            오늘의 개통
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{filtered.tod}</span>
            <span className="text-sm text-muted-foreground">건</span>
          </div>
          <SegBadges counts={todaySeg} onSelect={setSegment} active={segment} />
          <div className="mt-1">
            <Delta value={todayDelta} label="전일 대비" />
          </div>
        </Card>

        {/* 개통 대기 */}
        <Card
          className={cn(
            "p-2.5 glass relative overflow-hidden cursor-pointer transition-all hover:shadow-glow",
            hasPending && "border-warning/40"
          )}
          onClick={() => navigate("/activities?tab=incomplete")}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className={cn("size-3", hasPending ? "text-warning" : "text-muted-foreground")} />
            개통 대기
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-bold tabular-nums leading-none", hasPending ? "text-warning" : "text-muted-foreground")}>
              {filtered.pend}
            </span>
            <span className="text-sm text-muted-foreground">건</span>
          </div>
          <SegBadges counts={pendSeg} onSelect={setSegment} active={segment} />
          <div className="mt-1">
            {filtered.urgent > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md text-destructive bg-destructive/10 border border-destructive/20">
                <AlertTriangle className="size-2.5" />
                긴급 {filtered.urgent}건
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">긴급 대기 없음</span>
            )}
          </div>
        </Card>

        {/* 누적 개통 */}
        <Card className="p-2.5 glass relative overflow-hidden">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <TrendingUp className="size-3 text-success" />
            누적 개통 ({label})
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-foreground tabular-nums leading-none">{filtered.cur}</span>
            <span className="text-sm text-muted-foreground">건</span>
          </div>
          <SegBadges counts={curSeg} onSelect={setSegment} active={segment} />
          <div className="mt-1">
            <Delta value={periodDelta} label={prevLabel} />
          </div>
          <div className="text-[10px] text-muted-foreground">
            이전 동기간 {filtered.prev.toLocaleString()}건
          </div>
        </Card>
      </div>
    </section>
  );
};
