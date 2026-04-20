import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
  Line, LineChart,
} from "recharts";
import { useFinanceData } from "@/hooks/useFinanceData";
import { EmptyHint } from "./EmptyHint";

const formatKRW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");

const palette = [
  "hsl(155 70% 50%)", "hsl(220 85% 60%)", "hsl(0 85% 60%)",
  "hsl(320 85% 60%)", "hsl(25 95% 60%)", "hsl(210 90% 60%)",
  "hsl(280 80% 65%)", "hsl(180 70% 55%)",
];

export const MediaSpendStack = () => {
  const { loading, daily, mediaList, mediaTotals, totalAdSpend, hasSpend } =
    useFinanceData();

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="text-base font-semibold tracking-tight">채널별 광고비 집행 현황</h4>
          <p className="text-xs text-muted-foreground mt-0.5">일별 매체별 집행 (단위: 원)</p>
        </div>
        <div className="text-xs text-muted-foreground">
          총 집행 <span className="text-expense font-bold text-sm">{formatKRW(totalAdSpend)}</span>
        </div>
      </div>

      {!loading && !hasSpend && (
        <div className="mb-3">
          <EmptyHint
            message="해당 기간에 등록된 광고비가 없습니다. 지출 데이터를 입력해 주세요."
            actionLabel="지출 입력"
            actionHref="/expense-input"
          />
        </div>
      )}

      <div className="h-72">
        {loading ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : !hasSpend ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">표시할 광고비 데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={daily} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={formatKRW} />
              <Tooltip
                cursor={{ fill: "hsl(var(--expense) / 0.08)" }}
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12, fontSize: 12,
                }}
                formatter={(v: number, n) => [formatKRW(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
              {mediaList.map((m, i) => (
                <Bar
                  key={m}
                  dataKey={m}
                  stackId="spend"
                  fill={palette[i % palette.length]}
                  radius={i === mediaList.length - 1 ? [8, 8, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {hasSpend && daily.length > 0 && (
        <div className="mt-4 h-24">
          <div className="text-[11px] text-muted-foreground mb-1">일별 총 지출 라인</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12, fontSize: 12,
                }}
                formatter={(v: number) => [formatKRW(v), "총 지출"]}
              />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--expense))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {mediaTotals.length > 0 && (
        <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
          {mediaTotals.map((m, i) => (
            <div key={m.media} className="rounded-xl bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 rounded-full" style={{ background: palette[i % palette.length] }} />
                <span className="text-muted-foreground">{m.media}</span>
              </div>
              <div className="mt-1 text-sm font-bold text-expense tabular-nums">{formatKRW(m.total)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
