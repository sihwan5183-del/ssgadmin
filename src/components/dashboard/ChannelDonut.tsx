import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

const CHANNEL_PALETTE = [
  "hsl(35 95% 60%)",
  "hsl(270 90% 65%)",
  "hsl(320 90% 65%)",
  "hsl(195 90% 60%)",
  "hsl(160 80% 50%)",
  "hsl(0 0% 60%)",
];

export const ChannelDonut = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<{ name: string; value: number; color: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("channel")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);

      if (!alive) return;

      const counts = new Map<string, number>();
      (data ?? []).forEach((row: any) => {
        const channel = row.channel?.trim() || "기타";
        counts.set(channel, (counts.get(channel) ?? 0) + 1);
      });

      const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
      setRows(
        Array.from(counts.entries())
          .map(([name, count], idx) => ({
            name,
            value: total > 0 ? Math.round((count / total) * 100) : 0,
            color: CHANNEL_PALETTE[idx % CHANNEL_PALETTE.length],
          }))
          .sort((a, b) => b.value - a.value),
      );
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const total = useMemo(() => rows.reduce((s, c) => s + c.value, 0), [rows]);

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated h-full">
      <h3 className="text-lg font-semibold tracking-tight">인입 경로별 비중</h3>
      <p className="text-xs text-muted-foreground mt-1">당월 신규 개통 기준</p>

      <div className="relative h-52 mt-2">
        {loading ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">선택한 기간의 채널 데이터가 없습니다</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">
                {rows.map((c) => <Cell key={c.name} fill={c.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v: number) => `${v}%`}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">총합</div>
            <div className="text-2xl font-bold text-gradient">{total}%</div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((c) => (
          <div key={c.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: c.color }} />
              <span className="text-foreground/90">{c.name}</span>
            </div>
            <span className="text-muted-foreground tabular-nums">{c.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
