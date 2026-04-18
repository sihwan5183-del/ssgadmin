import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, ReferenceLine,
} from "recharts";
import { channelEconomics, formatKRWShort } from "@/data/financeData";
import { Target } from "lucide-react";

export const CpaChart = () => {
  const data = channelEconomics
    .map((c) => ({
      channel: c.channel,
      cpa: Math.round(c.spend / c.successCount),
      successCount: c.successCount,
    }))
    .sort((a, b) => a.cpa - b.cpa);

  const avg = Math.round(data.reduce((s, d) => s + d.cpa, 0) / data.length);
  const best = data[0];
  const worst = data[data.length - 1];

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">CPA · 고객 획득 비용</h4>
          <p className="text-xs text-muted-foreground mt-0.5">한 건 개통에 드는 광고 단가 (낮을수록 좋음)</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Target className="size-3" /> 평균 <span className="text-foreground font-semibold tabular-nums">{formatKRWShort(avg)}</span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number" stroke="hsl(var(--muted-foreground))" fontSize={11}
              tickLine={false} axisLine={false} tickFormatter={(v) => formatKRWShort(v)}
            />
            <YAxis
              type="category" dataKey="channel" stroke="hsl(var(--muted-foreground))"
              fontSize={11} tickLine={false} axisLine={false} width={50}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--expense) / 0.08)" }}
              contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number) => [formatKRWShort(v), "CPA"]}
            />
            <ReferenceLine x={avg} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
            <Bar dataKey="cpa" radius={[0, 8, 8, 0]}>
              {data.map((d) => (
                <Cell
                  key={d.channel}
                  fill={d.cpa <= avg ? "hsl(var(--revenue))" : "hsl(var(--expense))"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-revenue/30 bg-[hsl(var(--revenue-soft))] p-3">
          <div className="text-[11px] text-muted-foreground">최저 CPA · 효율 1위</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">{best.channel}</span>
            <span className="text-base font-bold text-revenue tabular-nums">{formatKRWShort(best.cpa)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-expense/30 bg-[hsl(var(--expense-soft))] p-3">
          <div className="text-[11px] text-muted-foreground">최고 CPA · 점검 필요</div>
          <div className="mt-0.5 flex items-baseline justify-between">
            <span className="text-sm font-semibold">{worst.channel}</span>
            <span className="text-base font-bold text-expense tabular-nums">{formatKRWShort(worst.cpa)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
