import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { channelShare } from "@/data/mockData";

export const ChannelDonut = () => {
  const total = channelShare.reduce((s, c) => s + c.value, 0);
  return (
    <div className="glass rounded-xl p-4 shadow-card-elevated h-full">
      <h3 className="text-sm font-semibold tracking-tight">인입 경로별 비중</h3>
      <p className="text-[10px] text-muted-foreground mt-0.5">당월 신규 개통 기준</p>

      <div className="relative h-44 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={channelShare}
              dataKey="value"
              innerRadius={62}
              outerRadius={88}
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
            <div className="text-xs text-muted-foreground">총합</div>
            <div className="text-2xl font-bold text-gradient">{total}%</div>
          </div>
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {channelShare.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-foreground/90">{c.name}</span>
            </div>
            <span className="text-muted-foreground tabular-nums text-[11px]">{c.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
