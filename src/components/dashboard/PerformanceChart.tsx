import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { dailyPerformance } from "@/data/mockData";

export const PerformanceChart = () => {
  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated h-full">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">일별 실적 추이</h3>
          <p className="text-xs text-muted-foreground mt-1">최근 14일 · 개통 건수와 순이익(백만원)</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />개통</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-secondary" />순이익</span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={dailyPerformance} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
            <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(240 18% 8% / 0.95)",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="실적" stroke="hsl(270 90% 70%)" strokeWidth={2.5} fill="url(#grad-perf)" />
            <Area type="monotone" dataKey="순이익" stroke="hsl(320 90% 70%)" strokeWidth={2.5} fill="url(#grad-profit)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
