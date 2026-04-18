import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { channelEconomics, formatKRWShort } from "@/data/financeData";

// 채널 × 주차별 평균 오퍼(샘플 추세 — 평균을 중심으로 ±10% 변동)
const weeks = ["W1", "W2", "W3", "W4"];
const trendData = weeks.map((w, idx) => {
  const row: Record<string, number | string> = { week: w };
  channelEconomics.forEach((c, i) => {
    const wave = [0.94, 1.03, 1.08, 0.97][idx] + (i % 2 === 0 ? 0.01 : -0.01);
    row[c.channel] = Math.round(c.avgOffer * wave);
  });
  return row;
});

const palette = [
  "hsl(350 85% 62%)", "hsl(330 85% 65%)", "hsl(15 90% 60%)",
  "hsl(35 95% 60%)", "hsl(280 80% 65%)", "hsl(220 75% 60%)",
];

export const OfferTrendChart = () => {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">건당 지원금(오퍼) 추이</h4>
          <p className="text-xs text-muted-foreground mt-0.5">채널별 고객 평균 지원금 모니터링</p>
        </div>
        <span className="text-[11px] text-muted-foreground">최근 4주</span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v) => formatKRWShort(v)}
            />
            <Tooltip
              contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, n) => [formatKRWShort(v), n]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            {channelEconomics.map((c, i) => (
              <Line
                key={c.channel}
                type="monotone"
                dataKey={c.channel}
                stroke={palette[i % palette.length]}
                strokeWidth={2.2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
