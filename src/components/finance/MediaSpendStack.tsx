import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  mediaWeekly, mediaList, mediaPalette, channelEconomics,
  formatKRWShort, formatM,
} from "@/data/financeData";

export const MediaSpendStack = () => {
  const totalByMedia = mediaList.map((m) => ({
    name: m,
    total: mediaWeekly.reduce((s, w) => s + (w as any)[m], 0),
  }));
  const grand = totalByMedia.reduce((s, m) => s + m.total, 0);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <h4 className="text-base font-semibold tracking-tight">채널별 광고비 집행 현황</h4>
          <p className="text-xs text-muted-foreground mt-0.5">매체 × 주차 누적 (단위: 원)</p>
        </div>
        <div className="text-xs text-muted-foreground">
          총 집행 <span className="text-expense font-bold text-sm">{formatKRWShort(grand)}</span>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mediaWeekly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis
              stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
              tickFormatter={(v) => formatM(v)}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--expense) / 0.08)" }}
              contentStyle={{
                background: "hsl(240 18% 8% / 0.95)",
                border: "1px solid hsl(var(--border))",
                borderRadius: 12, fontSize: 12,
              }}
              formatter={(v: number, n) => [formatKRWShort(v), n]}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
            {mediaList.map((m, i) => (
              <Bar
                key={m}
                dataKey={m}
                stackId="spend"
                fill={mediaPalette[m]}
                radius={i === mediaList.length - 1 ? [8, 8, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
        {totalByMedia
          .sort((a, b) => b.total - a.total)
          .map((m) => (
            <div key={m.name} className="rounded-xl bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 rounded-full" style={{ background: mediaPalette[m.name] }} />
                <span className="text-muted-foreground">{m.name}</span>
              </div>
              <div className="mt-1 text-sm font-bold text-expense tabular-nums">{formatKRWShort(m.total)}</div>
            </div>
          ))}
      </div>

      {/* CPA 미니 표 — 빠른 참고 */}
      <div className="mt-5 pt-4 border-t border-border/40">
        <div className="text-xs text-muted-foreground mb-2">CPA 빠른 참고 · 광고비 ÷ 성공건수</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {channelEconomics.slice(0, 6).map((c) => {
            const cpa = Math.round(c.spend / c.successCount);
            return (
              <div key={c.channel} className="flex items-center justify-between rounded-lg bg-card/30 border border-border/40 px-3 py-2">
                <span className="text-xs">{c.channel}</span>
                <span className="text-sm font-bold tabular-nums text-expense">{formatKRWShort(cpa)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
