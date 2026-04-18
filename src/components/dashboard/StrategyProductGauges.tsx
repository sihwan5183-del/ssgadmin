import { strategyProductsDetail } from "@/data/performanceData";
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from "recharts";

export const StrategyProductGauges = () => {
  const totals = strategyProductsDetail.reduce(
    (acc, p) => ({ current: acc.current + p.current, target: acc.target + p.target }),
    { current: 0, target: 0 }
  );
  const overallPct = Math.round((totals.current / totals.target) * 100);

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-semibold tracking-tight">전략상품(2ND) 종합 달성률</h4>
            <p className="text-xs text-muted-foreground mt-0.5">인터넷 · TV프리 · IOT · 대명</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gradient tabular-nums">{overallPct}%</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">{totals.current} / {totals.target} 건</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {strategyProductsDetail.map((p) => {
          const pct = Math.min(100, Math.round((p.current / p.target) * 100));
          const data = [{ name: p.name, value: pct, fill: p.color }];
          return (
            <div key={p.name} className="glass rounded-2xl p-5 text-center">
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="text-[11px] text-muted-foreground">목표 {p.target}건</div>

              <div className="relative h-36 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={220} endAngle={-40}>
                    <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                    <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={20} />
                  </RadialBarChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: p.color }}>{pct}%</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">{p.current}건</div>
                  </div>
                </div>
              </div>

              <div className="mt-1 text-[11px] text-muted-foreground">
                잔여 <span className="text-foreground font-medium">{Math.max(0, p.target - p.current)}건</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
