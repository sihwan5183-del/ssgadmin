import { useEffect, useState, useMemo } from "react";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { useAppSettings } from "@/hooks/useAppSettings";

/**
 * 반원형 목표 달성률 게이지
 * - 0~50%: 빨강 / 51~80%: 노랑 / 81~100%: 초록
 */
export const RadialGoalGauge = () => {
  const { startDate, endDate, label } = usePeriod();
  const { settings } = useAppSettings();
  const monthlyTarget = Number(settings?.monthly_target ?? 100);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase
      .from("sales")
      .select("id", { count: "exact", head: true })
      .gte("open_date", startDate)
      .lte("open_date", endDate)
      .neq("status", "취소")
      .then(({ count }) => {
        if (alive) setCurrent(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const pct = Math.min(100, Math.round((current / Math.max(1, monthlyTarget)) * 100));

  const { color, glow, status } = useMemo(() => {
    if (pct <= 50) return { color: "hsl(0 75% 55%)", glow: "hsl(0 75% 55% / 0.4)", status: "주의" };
    if (pct <= 80) return { color: "hsl(38 92% 50%)", glow: "hsl(38 92% 50% / 0.4)", status: "정상" };
    return { color: "hsl(158 65% 42%)", glow: "hsl(158 65% 42% / 0.4)", status: "초과달성" };
  }, [pct]);

  // 반원 (180도) — SVG arc
  const size = 220;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = Math.PI * radius; // 반원
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="glass rounded-xl p-4 shadow-card-elevated relative overflow-hidden">
      <div className="absolute -right-10 -top-10 size-40 rounded-full opacity-20 blur-2xl" style={{ background: color }} />

      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Target className="size-3.5 text-primary" />
        {label} 목표 달성률
      </div>

      <div className="relative mt-1 flex justify-center">
        <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
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

        {/* 중앙 숫자 */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tabular-nums leading-none" style={{ color, textShadow: `0 0 20px ${glow}` }}>
              {pct}
            </span>
            <span className="text-xl font-semibold text-foreground">%</span>
          </div>
          <span
            className="mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: glow, color }}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{current.toLocaleString()}</span> / {monthlyTarget.toLocaleString()} 건
        </span>
        <span className="text-muted-foreground">
          잔여 <span className="font-semibold text-foreground">{Math.max(0, monthlyTarget - current).toLocaleString()}</span>건
        </span>
      </div>
    </div>
  );
};
