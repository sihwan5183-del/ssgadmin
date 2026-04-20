import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { Inquiry } from "@/hooks/useInquiries";

interface Props {
  rows: Inquiry[];
}

const COLORS = ["hsl(270 90% 65%)", "hsl(320 90% 65%)", "hsl(200 90% 60%)", "hsl(40 95% 60%)", "hsl(150 70% 55%)", "hsl(0 80% 65%)", "hsl(180 70% 55%)"];

export const InquiryDashboard = ({ rows }: Props) => {
  // 채널별 인입/전환
  const byChannel = useMemo(() => {
    const map = new Map<string, { channel: string; total: number; converted: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.channel) ?? { channel: r.channel, total: 0, converted: 0 };
      cur.total += 1;
      if (r.status === "개통완료") cur.converted += 1;
      map.set(r.channel, cur);
    });
    return Array.from(map.values())
      .map((c) => ({ ...c, rate: c.total > 0 ? Math.round((c.converted / c.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  // 일별 인입 추이
  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; 인입: number; 개통: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.inquiry_date) ?? { day: r.inquiry_date.slice(5), 인입: 0, 개통: 0 };
      cur.인입 += 1;
      if (r.status === "개통완료") cur.개통 += 1;
      map.set(r.inquiry_date, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [rows]);

  const totals = useMemo(() => {
    const total = rows.length;
    const converted = rows.filter((r) => r.status === "개통완료").length;
    const pending = rows.filter((r) => r.status === "문의중").length;
    const visit = rows.filter((r) => r.status === "방문예약").length;
    return { total, converted, pending, visit, rate: total > 0 ? Math.round((converted / total) * 100) : 0 };
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card className="p-3"><div className="text-xs text-muted-foreground">총 인입</div><div className="text-2xl font-semibold mt-1">{totals.total}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">문의중</div><div className="text-2xl font-semibold mt-1">{totals.pending}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">방문예약</div><div className="text-2xl font-semibold mt-1">{totals.visit}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">개통완료</div><div className="text-2xl font-semibold mt-1 text-primary">{totals.converted}</div></Card>
        <Card className="p-3"><div className="text-xs text-muted-foreground">전환율</div><div className="text-2xl font-semibold mt-1">{totals.rate}%</div></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">채널별 인입 & 전환율</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byChannel} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n: string, p: any) => {
                    if (n === "total") return [`${v}건 (전환 ${p.payload.converted}건 · ${p.payload.rate}%)`, "인입"];
                    return [v, n];
                  }}
                />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {byChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {byChannel.length > 0 && (
            <div className="mt-3 space-y-1">
              {byChannel.map((c, i) => (
                <div key={c.channel} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    {c.channel}
                  </span>
                  <span className="text-muted-foreground">{c.total}건 → {c.converted}건 · <span className="text-foreground font-medium">{c.rate}%</span></span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="text-sm font-semibold mb-3">일별 인입 추이</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={byDay} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="인입" stroke="hsl(270 90% 70%)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="개통" stroke="hsl(320 90% 70%)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
};
