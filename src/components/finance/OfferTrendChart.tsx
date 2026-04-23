import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { useFinanceData } from "@/hooks/useFinanceData";
import { EmptyHint } from "./EmptyHint";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

const palette = [
  "hsl(350 85% 62%)", "hsl(330 85% 65%)", "hsl(15 90% 60%)",
  "hsl(35 95% 60%)", "hsl(280 80% 65%)", "hsl(220 75% 60%)",
  "hsl(180 70% 55%)", "hsl(155 70% 50%)",
];

export const OfferTrendChart = () => {
  const { offerWeekly, channelNames, loading, hasSales } = useFinanceData();

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">건당 지원금(오퍼) 추이</h4>
          <p className="text-xs text-muted-foreground mt-0.5">채널별 고객 평균 지원금 (선택 기간 주차별)</p>
        </div>
        <span className="text-[11px] text-muted-foreground">{offerWeekly.length}주</span>
      </div>

      {!loading && !hasSales ? (
        <EmptyHint message="해당 기간에 개통 실적이 없어 오퍼 추이를 표시할 수 없습니다." />
      ) : offerWeekly.length === 0 ? (
        <div className="text-sm text-muted-foreground py-6 text-center">표시할 데이터가 없습니다</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={offerWeekly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={formatKRW} />
              <Tooltip
                contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)", padding: "8px 12px" }}
                formatter={(v: number, n) => [formatKRW(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
              {channelNames.map((c, i) => (
                <Line
                  key={c}
                  type="monotone"
                  dataKey={c}
                  stroke={palette[i % palette.length]}
                  strokeWidth={2.2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
