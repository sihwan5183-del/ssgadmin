import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useFinanceData } from "@/hooks/useFinanceData";
import { EmptyHint } from "./EmptyHint";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
const COLORS = [
  "hsl(var(--revenue))",
  "hsl(var(--success))",
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--warning))",
];

export const RevenueComposition = () => {
  const { revenueBreakdown, loading, hasSales } = useFinanceData();
  const items = revenueBreakdown.filter((r) => r.amount > 0);
  const total = items.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
          <h4 className="text-base font-semibold tracking-tight">수익 현황 그래프</h4>
          <span className="text-[11px] text-muted-foreground">확정 수익 항목만 표시</span>
      </div>

      {!loading && !hasSales ? (
        <EmptyHint message="해당 기간에 개통 실적이 없습니다." actionLabel="실적 입력" actionHref="/input" />
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">표시할 수익 데이터가 없습니다</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="amount" nameKey="label"
                  innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                  {items.map((r, i) => <Cell key={r.key} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)", padding: "8px 12px" }}
                  formatter={(v: number) => formatKRW(v)}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <div className="text-[10px] text-muted-foreground">총 수익</div>
                <div className="text-xl font-bold text-revenue tabular-nums">{formatKRW(total)}</div>
              </div>
            </div>
          </div>

          <ul className="space-y-2">
            {items.map((r, i) => {
              const pct = total > 0 ? Math.round((r.amount / total) * 100) : 0;
              return (
                <li key={r.key} className="rounded-xl bg-card/40 border border-border/40 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="font-medium">{r.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                  </div>
                  <div className="mt-1 text-base font-bold text-revenue tabular-nums">{formatKRW(r.amount)}</div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
