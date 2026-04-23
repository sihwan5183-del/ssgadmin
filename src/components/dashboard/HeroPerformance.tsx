import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Sun, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle, Smartphone, Monitor, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type Segment = "all" | "mobile" | "home";

const SEGMENTS: { key: Segment; label: string; icon: typeof Smartphone }[] = [
  { key: "all", label: "전체", icon: Package },
  { key: "mobile", label: "모바일", icon: Smartphone },
  { key: "home", label: "홈상품", icon: Monitor },
];

const isMobile = (p?: string | null) => !p || p.includes("모바일") || p === "USIM MNP" || p === "세컨";
const isHome = (p?: string | null) => !!p && (p.includes("인터넷") || p.includes("TV") || p.includes("IOT") || p.includes("홈"));

const matchSegment = (product: string | null, seg: Segment) => {
  if (seg === "all") return true;
  if (seg === "mobile") return isMobile(product);
  return isHome(product);
};

interface SegCount { mobile: number; home: number; etc: number; total: number }
const countBySegment = (rows: { product: string | null }[]): SegCount => {
  let mobile = 0, home = 0, etc = 0;
  rows.forEach((r) => {
    if (isMobile(r.product)) mobile++;
    else if (isHome(r.product)) home++;
    else etc++;
  });
  return { mobile, home, etc, total: mobile + home + etc };
};

const SegBadges = ({ seg }: { seg: SegCount }) => (
  <div className="flex items-center gap-1.5 mt-1">
    <span className="inline-flex items-center gap-0.5 text-[10px] text-primary font-medium">
      <Smartphone className="size-2.5" />{seg.mobile}
    </span>
    <span className="inline-flex items-center gap-0.5 text-[10px] text-accent-foreground font-medium">
      <Monitor className="size-2.5" />{seg.home}
    </span>
    {seg.etc > 0 && (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-medium">
        <Package className="size-2.5" />{seg.etc}
      </span>
    )}
  </div>
);

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
  const [pendingRows, setPendingRows] = useState<{ product: string | null; created_at: string }[]>([]);
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
        supabase.from("sales").select("product").gte("open_date", startDate).lte("open_date", endDate).eq("status", "개통완료").limit(10000),
        supabase.from("sales").select("product").gte("open_date", prevStartDate).lte("open_date", prevEndDate).eq("status", "개통완료").limit(10000),
        supabase.from("sales").select("product").eq("open_date", todayISO).eq("status", "개통완료").limit(5000),
        supabase.from("sales").select("product").eq("open_date", ydayISO).eq("status", "개통완료").limit(5000),
        supabase.from("sales").select("product, created_at").in("status", ["개통대기", "접수완료"]).limit(5000),
      ]);
      if (!alive) return;
      setCurrentRows(a.data ?? []);
      setPrevRows(b.data ?? []);
      setTodayRows(c.data ?? []);
      setYdayRows(d.data ?? []);
      setPendingRows(e.data ?? []);
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

  const todaySeg = useMemo(() => countBySegment(todayRows), [todayRows]);
  const pendSeg = useMemo(() => countBySegment(pendingRows), [pendingRows]);
  const curSeg = useMemo(() => countBySegment(currentRows), [currentRows]);

  const periodDelta = filtered.prev === 0 ? (filtered.cur > 0 ? 100 : 0) : ((filtered.cur - filtered.prev) / filtered.prev) * 100;
  const todayDelta = filtered.yd === 0 ? (filtered.tod > 0 ? 100 : 0) : ((filtered.tod - filtered.yd) / filtered.yd) * 100;
  const prevLabel = month === 0 ? "전년 대비" : "전월 대비";
  const hasPending = filtered.pend > 0;

  return (
    <section className="h-full flex flex-col gap-1.5">
      {/* Segment tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 w-fit">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <s.icon className="size-3" />
              {s.label}
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
          {segment === "all" && <SegBadges seg={todaySeg} />}
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
          onClick={() => navigate("/input?status=개통대기")}
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
          {segment === "all" && <SegBadges seg={pendSeg} />}
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
          {segment === "all" && <SegBadges seg={curSeg} />}
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
