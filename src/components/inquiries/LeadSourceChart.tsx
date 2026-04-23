import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";

interface Row {
  channel: string;
  status: string;
}

const COLORS = [
  "hsl(152 76% 50%)",
  "hsl(200 80% 55%)",
  "hsl(270 90% 65%)",
  "hsl(320 90% 65%)",
  "hsl(40 95% 60%)",
  "hsl(0 80% 65%)",
];

export const LeadSourceChart = ({ rows }: { rows: Row[] }) => {
  const data = useMemo(() => {
    const map = new Map<string, { channel: string; total: number; success: number }>();
    rows.forEach((r) => {
      const ch = r.channel || "기타";
      const cur = map.get(ch) ?? { channel: ch, total: 0, success: 0 };
      cur.total++;
      if (r.status === "개통완료") cur.success++;
      map.set(ch, cur);
    });
    return Array.from(map.values())
      .map((c) => ({ ...c, rate: c.total > 0 ? Math.round((c.success / c.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate);
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <Card className="glass border-border/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="size-4 text-primary" />
        <h4 className="text-sm font-semibold">인입 경로별 성공률</h4>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="channel" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis fontSize={10} tickLine={false} axisLine={false} unit="%" />
            <Tooltip
              contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)", padding: "8px 12px" }}
              formatter={(v: number, _: string, p: any) => [`${v}% (${p.payload.success}/${p.payload.total}건)`, "성공률"]}
            />
            <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1">
        {data.map((c, i) => (
          <div key={c.channel} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              {c.channel}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {c.success}/{c.total}건 · <span className="text-foreground font-medium">{c.rate}%</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
};