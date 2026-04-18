import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { revenueComposition, formatKRWShort } from "@/data/financeData";

export const RevenueComposition = () => {
  const total = revenueComposition.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h4 className="text-base font-semibold tracking-tight">항목별 수익 구성</h4>
        <span className="text-[11px] text-muted-foreground">단위: 원</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        <div className="relative h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={revenueComposition} dataKey="amount" nameKey="item"
                innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                {revenueComposition.map((r) => <Cell key={r.item} fill={r.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => formatKRWShort(v)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <div className="text-[10px] text-muted-foreground">총 수익</div>
              <div className="text-xl font-bold text-revenue tabular-nums">{formatKRWShort(total)}</div>
            </div>
          </div>
        </div>

        <ul className="space-y-2">
          {revenueComposition.map((r) => {
            const pct = Math.round((r.amount / total) * 100);
            return (
              <li key={r.item} className="rounded-xl bg-card/40 border border-border/40 p-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                    <span className="font-medium">{r.item}</span>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                </div>
                <div className="mt-1 text-base font-bold text-revenue tabular-nums">{formatKRWShort(r.amount)}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};
