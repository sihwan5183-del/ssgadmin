import { useEffect, useState, useMemo, useCallback } from "react";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { applyActivationFilter } from "@/lib/salesFilter";

/**
 * 반원형 목표 달성률 게이지
 * - 0~50%: 빨강 / 51~80%: 노랑 / 81~100%: 초록
 */
export const RadialGoalGauge = () => {
  const { startDate, endDate, label, year, month } = usePeriod();
  const { monthlyTarget: globalTarget } = useAppSettings();
  const [current, setCurrent] = useState(0);
  const [teamTarget, setTeamTarget] = useState(0);

  // 기간 기준 연-월 (월모드면 해당 월, 아니면 startDate 기준)
  const yearMonth = useMemo(() => {
    if (month && month >= 1 && month <= 12) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
    return startDate.slice(0, 7);
  }, [year, month, startDate]);

  // 누적 개통 건수 (Source of Truth: open_date 기간 내, 취소/개통취소/반려 제외)
  const fetchCurrent = useCallback(async () => {
    const q = applyActivationFilter(
      supabase.from("sales").select("id", { count: "exact", head: true }),
      startDate,
      endDate,
    );
    const { count } = await q;
    setCurrent(count ?? 0);
  }, [startDate, endDate]);

  useEffect(() => {
    fetchCurrent();
    const ch = supabase
      .channel("dashboard-gauge-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => fetchCurrent())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchCurrent]);

  // 팀 통합 목표 — 모바일 개통(mobile) 목표만 분모로 사용
  // (인터넷·TV·스마트홈·세컨드는 별도 위젯에서 다루므로 합산 시 분모가 과대평가됨)
  const loadTarget = async () => {
    const { data } = await supabase
      .from("team_product_goals")
      .select("goal_count")
      .eq("year_month", yearMonth)
      .eq("goal_type", "count")
      .eq("product", "mobile");
    const sum = (data ?? []).reduce((a: number, r: any) => a + Number(r.goal_count ?? 0), 0);
    setTeamTarget(sum);
  };

  useEffect(() => {
    loadTarget();
    const ch = supabase
      .channel("team_product_goals_dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "team_product_goals" }, () => loadTarget())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth]);

  const monthlyTarget = teamTarget > 0 ? teamTarget : globalTarget;

  const pct = monthlyTarget > 0
    ? Math.min(100, Math.round((current / monthlyTarget) * 1000) / 10)
    : 0;

  const { color, glow, status } = useMemo(() => {
    if (pct <= 50) return { color: "hsl(0 75% 55%)", glow: "hsl(0 75% 55% / 0.4)", status: "주의" };
    if (pct <= 80) return { color: "hsl(38 92% 50%)", glow: "hsl(38 92% 50% / 0.4)", status: "정상" };
    return { color: "hsl(158 65% 42%)", glow: "hsl(158 65% 42% / 0.4)", status: "초과달성" };
  }, [pct]);

  // 반원 (180도) — SVG arc · viewBox 좌표계 (실제 렌더 크기는 컨테이너에 100% 맞춤)
  const size = 220;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // 반원
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="h-full w-full flex flex-col bg-card rounded-xl border border-border/60 shadow-sm p-4 relative overflow-hidden">
      <div className="absolute -right-10 -top-10 size-40 rounded-full opacity-20 blur-2xl" style={{ background: color }} />

      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
        <Target className="size-3.5 text-primary" />
        {label} 목표 달성률
      </div>

      <div className="relative mt-1 flex-1 min-h-0 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size / 2 + 20}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full max-h-[260px]"
        >
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} stopOpacity="0.6" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
            <filter id="gauge-glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* 배경 호 */}
          <path
            d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
            stroke="hsl(var(--muted))"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
          />
          {/* 진행 호 */}
          <path
            d={`M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`}
            stroke="url(#gauge-grad)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter="url(#gauge-glow)"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.22,1,0.36,1)" }}
          />
        </svg>

        {/* 중앙 숫자 — 컨테이너 크기에 맞게 가변 */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
          <div className="flex items-baseline gap-1">
            <span
              className="font-black tabular-nums leading-none text-[clamp(1.75rem,7cqw,3.25rem)]"
              style={{ color, textShadow: `0 0 20px ${glow}` }}
            >
              {pct}
            </span>
            <span className="text-base font-bold text-foreground">%</span>
          </div>
          <span
            className="mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: glow, color }}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] flex-wrap gap-x-2">
        <span className="text-foreground/70">
          <span className="font-semibold text-foreground tabular-nums">{current.toLocaleString()}</span> / {monthlyTarget.toLocaleString()} 건
        </span>
        <span className="text-foreground/70">
          잔여 <span className="font-semibold text-foreground">{Math.max(0, monthlyTarget - current).toLocaleString()}</span>건
        </span>
      </div>
    </div>
  );
};
