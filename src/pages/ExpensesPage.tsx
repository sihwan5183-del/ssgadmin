import { Header } from "@/components/layout/Header";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { formatShortKRW } from "@/data/mockData";

const media = [
  { name: "네이버", spend: 12_400_000, revenue: 48_200_000 },
  { name: "메타", spend: 9_800_000, revenue: 31_500_000 },
  { name: "당근", spend: 6_200_000, revenue: 28_400_000 },
  { name: "구글", spend: 8_100_000, revenue: 22_900_000 },
  { name: "카카오", spend: 5_400_000, revenue: 14_300_000 },
];

const ExpensesPage = () => {
  const data = media.map((m) => ({ ...m, roi: Math.round(((m.revenue - m.spend) / m.spend) * 100) }));
  const totalSpend = data.reduce((s, d) => s + d.spend, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalRoi = Math.round(((totalRevenue - totalSpend) / totalSpend) * 100);

  return (
    <>
      <Header title="지출 / ROI" subtitle="매체별 마케팅 광고비와 효율 분석" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="glass rounded-2xl p-5 shadow-card-elevated">
          <div className="text-xs text-muted-foreground">총 광고비</div>
          <div className="mt-2 text-2xl font-bold">{formatShortKRW(totalSpend)}</div>
        </div>
        <div className="glass rounded-2xl p-5 shadow-card-elevated">
          <div className="text-xs text-muted-foreground">발생 매출</div>
          <div className="mt-2 text-2xl font-bold text-gradient">{formatShortKRW(totalRevenue)}</div>
        </div>
        <div className="glass rounded-2xl p-5 shadow-card-elevated">
          <div className="text-xs text-muted-foreground">전체 ROI</div>
          <div className="mt-2 text-2xl font-bold text-success">{totalRoi}%</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 shadow-card-elevated mb-6">
        <h3 className="text-lg font-semibold tracking-tight mb-4">매체별 ROI</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="bar-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(270 90% 70%)" />
                  <stop offset="100%" stopColor="hsl(320 90% 65%)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} unit="%" />
              <Tooltip
                contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                formatter={(v: number) => `${v}%`}
              />
              <Bar dataKey="roi" radius={[10, 10, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill="url(#bar-grad)" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 shadow-card-elevated">
        <h3 className="text-lg font-semibold tracking-tight mb-4">매체별 상세</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border/40">
                <th className="text-left py-3 px-2 font-medium">매체</th>
                <th className="text-right py-3 px-2 font-medium">광고비</th>
                <th className="text-right py-3 px-2 font-medium">발생 매출</th>
                <th className="text-right py-3 px-2 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.name} className="border-b border-border/20 hover:bg-white/[0.02]">
                  <td className="py-3 px-2 font-medium">{d.name}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{formatShortKRW(d.spend)}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{formatShortKRW(d.revenue)}</td>
                  <td className="py-3 px-2 text-right tabular-nums font-semibold text-success">{d.roi}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default ExpensesPage;
