import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Line, LineChart,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";
import { dailyPerformance } from "@/data/mockData";

type ViewMode = "daily" | "monthly";

interface DayPoint {
  day: string;       // MM-DD
  date: string;      // yyyy-MM-DD
  실적: number;       // 개통 건수
  순이익: number;      // 백만원 단위
  지출: number;       // 백만원 단위
}

const pad = (n: number) => String(n).padStart(2, "0");

export const PerformanceChart = () => {
  const { startDate, endDate, mode } = usePeriod();
  const [view, setView] = useState<ViewMode>("daily");
  const [data, setData] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: salesRows }, { data: spendRows }] = await Promise.all([
        supabase
          .from("sales")
          .select("open_date, net_fee, distributor_amount, cash_support_amount, receivable_amount")
          .gte("open_date", startDate)
          .lte("open_date", endDate),
        supabase
          .from("ad_spend")
          .select("spend_date, amount")
          .gte("spend_date", startDate)
          .lte("spend_date", endDate),
      ]);

      // Build day buckets between startDate..endDate
      const buckets = new Map<string, DayPoint>();
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        buckets.set(iso, {
          date: iso,
          day: `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
          실적: 0,
          순이익: 0,
          지출: 0,
        });
      }

      (salesRows ?? []).forEach((s: any) => {
        if (!s.open_date) return;
        const b = buckets.get(s.open_date);
        if (!b) return;
        b.실적 += 1;
        const profit =
          Number(s.net_fee ?? 0) -
          Number(s.distributor_amount ?? 0) -
          Number(s.cash_support_amount ?? 0) -
          Number(s.receivable_amount ?? 0);
        b.순이익 += profit / 1_000_000;
      });
      (spendRows ?? []).forEach((r: any) => {
        const b = buckets.get(r.spend_date);
        if (!b) return;
        b.지출 += Number(r.amount ?? 0) / 1_000_000;
      });

      setData(Array.from(buckets.values()).map((d) => ({
        ...d,
        순이익: Math.round(d.순이익 * 10) / 10,
        지출: Math.round(d.지출 * 10) / 10,
      })));
      setLoading(false);
    })();
  }, [startDate, endDate]);

  // Use mock data if completely empty (no DB rows yet)
  const chartData = useMemo(() => {
    const hasReal = data.some((d) => d.실적 > 0 || d.순이익 !== 0 || d.지출 !== 0);
    if (hasReal) return data;
    return dailyPerformance.map((d: any) => ({
      day: d.day,
      date: d.day,
      실적: d.실적,
      순이익: d.순이익,
      지출: 0,
    }));
  }, [data]);

  // Monthly aggregation (for monthly view when range spans multiple months)
  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; 실적: number; 순이익: number; 지출: number }>();
    chartData.forEach((d) => {
      const key = d.date.slice(0, 7);
      const cur = m.get(key) ?? { month: key.slice(2).replace("-", "/"), 실적: 0, 순이익: 0, 지출: 0 };
      cur.실적 += d.실적;
      cur.순이익 += d.순이익;
      cur.지출 += d.지출;
      m.set(key, cur);
    });
    return Array.from(m.values()).map((r) => ({
      ...r,
      순이익: Math.round(r.순이익 * 10) / 10,
      지출: Math.round(r.지출 * 10) / 10,
    }));
  }, [chartData]);

  const subtitle = useMemo(() => {
    if (view === "monthly") return `월별 합계 · 개통 건수 · 순이익(백만원)`;
    if (mode === "day") return `${startDate} · 일별 흐름`;
    if (mode === "range") return `${startDate} ~ ${endDate} · 일별 흐름`;
    return `${startDate.slice(0, 7)} 1일 ~ 말일 · 일별 흐름`;
  }, [view, mode, startDate, endDate]);

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated h-full">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">실적 추이</h3>
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
            {(["daily", "monthly"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  view === v ? "bg-primary/20 text-primary-glow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "daily" ? "일별" : "월별"}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />개통</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-secondary" />순이익</span>
          </div>
        </div>
      </div>
      <div className="h-72">
        {loading ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : view === "daily" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="L" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis yAxisId="R" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number, n: string) => {
                  if (n === "실적") return [`${v}건`, "개통 건수"];
                  if (n === "순이익") return [`${v.toFixed(1)}백만원`, "순이익"];
                  if (n === "지출") return [`${v.toFixed(1)}백만원`, "지출"];
                  return [v, n];
                }}
                labelFormatter={(l) => `${l}`}
              />
              <Line yAxisId="L" type="monotone" dataKey="실적" stroke="hsl(270 90% 70%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              <Line yAxisId="R" type="monotone" dataKey="순이익" stroke="hsl(320 90% 70%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-perf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(270 90% 65%)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="hsl(270 90% 65%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(320 90% 65%)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(320 90% 65%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number, n: string) => {
                  if (n === "실적") return [`${v}건`, "개통 건수"];
                  if (n === "순이익") return [`${v.toFixed(1)}백만원`, "순이익"];
                  return [v, n];
                }}
              />
              <Area type="monotone" dataKey="실적" stroke="hsl(270 90% 70%)" strokeWidth={2.5} fill="url(#grad-perf)" />
              <Area type="monotone" dataKey="순이익" stroke="hsl(320 90% 70%)" strokeWidth={2.5} fill="url(#grad-profit)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
