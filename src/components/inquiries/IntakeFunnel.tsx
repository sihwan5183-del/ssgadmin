import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

interface InquiryRow {
  id: string;
  inquiry_date: string;
  channel: string;
  customer_name: string | null;
  birth_date: string | null;
  phone: string | null;
  content: string | null;
  manager: string | null;
  status: string;
  note: string | null;
  retry_at: string | null;
  fail_reason: string | null;
  last_action_at: string | null;
  created_by: string;
  created_at: string;
}

export function IntakeFunnel({ rows }: { rows: InquiryRow[] }) {
  const channels = useMemo(() => {
    const map = new Map<string, { total: number; absent: number; recare: number; failed: number; success: number }>();
    for (const r of rows) {
      const ch = r.channel || "기타";
      const cur = map.get(ch) ?? { total: 0, absent: 0, recare: 0, failed: 0, success: 0 };
      cur.total++;
      if (r.status === "부재") cur.absent++;
      else if (r.status === "재케어") cur.recare++;
      else if (r.status === "실패") cur.failed++;
      else if (r.status === "개통완료") cur.success++;
      map.set(ch, cur);
    }
    return Array.from(map.entries())
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const totalInquiries = rows.length;
  const contacted = rows.filter((r) => r.status !== "부재").length;
  const caring = rows.filter((r) => ["재케어", "방문예약", "개통완료"].includes(r.status)).length;
  const converted = rows.filter((r) => r.status === "개통완료").length;

  const funnelData = [
    { name: "총 인입", value: totalInquiries, fill: "hsl(var(--primary))" },
    { name: "연결 성공", value: contacted, fill: "hsl(200 80% 55%)" },
    { name: "상담 진행", value: caring, fill: "hsl(35 90% 55%)" },
    { name: "개통 완료", value: converted, fill: "hsl(152 76% 50%)" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="glass border-border/40 p-4">
        <h4 className="text-sm font-semibold mb-3">전환 퍼널</h4>
        <div className="space-y-2">
          {funnelData.map((d) => {
            const pct = totalInquiries > 0 ? Math.round((d.value / totalInquiries) * 100) : 0;
            return (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-16 shrink-0">{d.name}</span>
                <div className="flex-1 h-7 rounded-md bg-muted/40 overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{ width: `${pct}%`, background: d.fill }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums">
                    {d.value}건 ({pct}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass border-border/40 p-4">
        <h4 className="text-sm font-semibold mb-3">채널별 이탈 현황</h4>
        {channels.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">데이터 없음</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channels.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="channel" fontSize={11} tickLine={false} axisLine={false} width={55} />
                <Tooltip
                  contentStyle={{ background: "hsl(0 0% 100% / 0.96)", color: "#374151", border: "1px solid hsl(0 0% 88%)", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)", padding: "8px 12px" }}
                />
                <Bar dataKey="absent" name="부재" stackId="a" fill="hsl(35 90% 55%)" />
                <Bar dataKey="recare" name="재케어" stackId="a" fill="hsl(200 80% 55%)" />
                <Bar dataKey="failed" name="실패" stackId="a" fill="hsl(0 70% 55%)" />
                <Bar dataKey="success" name="개통" stackId="a" fill="hsl(152 76% 50%)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
