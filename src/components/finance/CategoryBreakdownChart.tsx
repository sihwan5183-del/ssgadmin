import { Card } from "@/components/ui/card";
import { useFinanceData } from "@/hooks/useFinanceData";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = [
  "hsl(152 76% 50%)", "hsl(195 75% 55%)", "hsl(210 70% 55%)",
  "hsl(45 80% 55%)", "hsl(280 70% 60%)", "hsl(0 70% 60%)",
  "hsl(168 75% 55%)", "hsl(220 10% 60%)",
];

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

export function CategoryBreakdownChart({ type }: { type: "지출" | "수익" }) {
  const { categoryBreakdown, revenueBreakdown, expenseBreakdown, loading } = useFinanceData();

  const formulaItems = type === "수익" ? revenueBreakdown : expenseBreakdown;
  const items = formulaItems.length > 0
    ? formulaItems.map((i) => ({ label: i.label, amount: i.amount, included: true }))
    : categoryBreakdown
      .filter((c) => c.type === type && c.amount > 0)
      .sort((a, b) => b.amount - a.amount);

  const total = items.reduce((s, i) => s + i.amount, 0);

  if (loading || items.length === 0) {
    return (
      <Card className="p-5 glass">
        <h3 className="text-sm font-semibold mb-2">{type} 현황 그래프</h3>
        <p className="text-xs text-muted-foreground py-8 text-center">
          {loading ? "로딩 중…" : "데이터 없음"}
        </p>
      </Card>
    );
  }

  const data = items.map((i, idx) => ({
    name: i.label + (i.included ? "" : " (제외)"),
    value: i.amount,
    fill: COLORS[idx % COLORS.length],
    pct: total > 0 ? ((i.amount / total) * 100).toFixed(1) : "0",
  }));

  return (
    <Card className="p-5 glass">
      <h3 className="text-sm font-semibold mb-1">{type} 현황 그래프</h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        0원 항목 제외 · 합계 {formatKRW(total)} · {items.length}개 항목
      </p>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => formatKRW(v)}
              contentStyle={{
                background: "hsl(0 0% 100% / 0.96)",
                color: "#374151",
                border: "1px solid hsl(0 0% 88%)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)",
                padding: "8px 12px",
              }}
            />
            <Legend
              formatter={(value: string, entry: any) => {
                const item = data.find((d) => d.name === value);
                return `${value} (${item?.pct ?? 0}%)`;
              }}
              wrapperStyle={{ fontSize: 11 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}