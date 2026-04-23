import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Target, Sun, TrendingUp, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const Delta = ({ value, label }: { value: number; label: string }) => {
  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={
          "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md " +
          (positive
            ? "text-success bg-success/10 border border-success/20"
            : "text-destructive bg-destructive/10 border border-destructive/20")
        }
      >
        <Icon className="size-3" />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
};

export const HeroPerformance = () => {
  const { startDate, endDate, prevStartDate, prevEndDate, label, year, month } = usePeriod();
  const { settings } = useAppSettings();
  const monthlyTarget = Number(settings?.monthly_target ?? 100);

  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState(0);
  const [today, setToday] = useState(0);
  const [yesterday, setYesterday] = useState(0);
  const [pending, setPending] = useState(0);
  const [urgentPending, setUrgentPending] = useState(0);
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

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

      const [a, b, c, d, e, f] = await Promise.all([
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .eq("status", "개통완료"),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .gte("open_date", prevStartDate)
          .lte("open_date", prevEndDate)
          .eq("status", "개통완료"),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("open_date", todayISO)
          .eq("status", "개통완료"),
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("open_date", ydayISO)
          .eq("status", "개통완료"),
        // 개통 대기 + 접수 완료 건수
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .in("status", ["개통대기", "접수완료"]),
        // 긴급 (3시간 이상 경과)
        supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .in("status", ["개통대기", "접수완료"])
          .lte("created_at", threeHoursAgo),
      ]);
      if (!alive) return;
      setCurrent(a.count ?? 0);
      setPrevious(b.count ?? 0);
      setToday(c.count ?? 0);
      setYesterday(d.count ?? 0);
      setPending(e.count ?? 0);
      setUrgentPending(f.count ?? 0);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate, prevStartDate, prevEndDate]);

  const achievement = Math.min(100, Math.round((current / Math.max(1, monthlyTarget)) * 100));
  const periodDelta = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
  const todayDelta = yesterday === 0 ? (today > 0 ? 100 : 0) : ((today - yesterday) / yesterday) * 100;
  const prevLabel = month === 0 ? "전년 대비" : "전월 대비";

  const hasPending = pending > 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-1.5 h-full">
      {/* 오늘의 개통 */}
      <Card className="p-3 glass relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Sun className="size-3.5 text-warning" />
          오늘의 개통
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground tabular-nums leading-none">
            {today}
          </span>
          <span className="text-base text-muted-foreground">건</span>
        </div>
        <div className="mt-2">
          <Delta value={todayDelta} label="전일 대비" />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          {loading ? "불러오는 중…" : "실시간 동기화 중"}
        </div>
      </Card>

      {/* 개통 대기 */}
      <Card
        className={cn(
          "p-3 glass relative overflow-hidden cursor-pointer transition-all hover:shadow-glow",
          hasPending && "border-warning/40"
        )}
        onClick={() => navigate("/input?status=개통대기")}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Clock className={cn("size-3.5", hasPending ? "text-warning" : "text-muted-foreground")} />
          개통 대기
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className={cn(
            "text-4xl font-bold tabular-nums leading-none",
            hasPending ? "text-warning" : "text-muted-foreground"
          )}>
            {pending}
          </span>
          <span className="text-base text-muted-foreground">건</span>
        </div>
        <div className="mt-2">
          {urgentPending > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded-md text-destructive bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="size-3" />
              긴급 {urgentPending}건 (3시간+ 경과)
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">긴급 대기 없음</span>
          )}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          클릭하여 대기 목록 보기
        </div>
      </Card>

      {/* 누적 개통 */}
      <Card className="p-3 glass relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <TrendingUp className="size-3.5 text-success" />
          누적 개통 ({label})
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-foreground tabular-nums leading-none">
            {current}
          </span>
          <span className="text-base text-muted-foreground">건</span>
        </div>
        <div className="mt-2">
          <Delta value={periodDelta} label={prevLabel} />
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">
          이전 동기간 {previous.toLocaleString()}건
        </div>
      </Card>
    </section>
  );
};
