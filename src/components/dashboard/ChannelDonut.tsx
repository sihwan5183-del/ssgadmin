import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { channelShare } from "@/data/mockData";

export const ChannelDonut = () => {
  const total = channelShare.reduce((s, c) => s + c.value, 0);
  return (
    <div className="glass rounded-xl p-3 md:p-4 shadow-card-elevated h-full flex flex-col">
      <h3 className="text-sm font-bold tracking-tight text-foreground">인입 경로별 비중 (TOP)</h3>
      <p className="text-[10px] text-muted-foreground mt-0.5">당월 신규 개통 기준</p>

      <div className="relative flex-1 min-h-[200px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={channelShare}
              dataKey="value"
              innerRadius="58%"
              outerRadius="92%"
              paddingAngle={3}
              stroke="none"
            >
              {channelShare.map((c) => (
                <Cell key={c.name} fill={c.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(0 0% 100% / 0.96)",
                color: "#374151",
                border: "1px solid hsl(0 0% 88%)",
                borderRadius: 12,
                fontSize: 12,
                boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)",
                padding: "8px 12px",
              }}
              formatter={(v: number) => `${v}%`}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-xs font-semibold text-muted-foreground">총합</div>
            <div className="text-3xl font-black text-foreground tabular-nums">{total}%</div>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {channelShare.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full" style={{ background: c.color }} />
              <span className="text-foreground font-semibold">{c.name}</span>
            </div>
            <span className="text-foreground font-bold tabular-nums">{c.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
