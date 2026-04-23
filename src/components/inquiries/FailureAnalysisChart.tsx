import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";

interface Row {
  status: string;
  fail_reason: string | null;
}

const COLORS = [
  "hsl(0 70% 55%)",
  "hsl(25 90% 55%)",
  "hsl(45 90% 50%)",
  "hsl(200 80% 55%)",
  "hsl(270 70% 60%)",
];

export const FailureAnalysisChart = ({ rows }: { rows: Row[] }) => {
  const data = useMemo(() => {
    const failed = rows.filter((r) => r.status === "실패" && r.fail_reason);
    const map = new Map<string, number>();
    failed.forEach((r) => {
      map.set(r.fail_reason!, (map.get(r.fail_reason!) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [rows]);

  if (data.length === 0) return null;

  return (
    <Card className="glass border-border/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="size-4 text-destructive" />
        <h4 className="text-sm font-semibold">실패 사유 TOP 5</h4>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 80, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="reason" fontSize={11} tickLine={false} axisLine={false} width={75} />
            <Tooltip
              contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
              formatter={(v: number) => [`${v}건`, "실패"]}
            />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};