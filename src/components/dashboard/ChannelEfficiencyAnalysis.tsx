import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Sparkles } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { classifySale, pureProfit, DEFAULT_CATEGORY_META } from "@/lib/salesCategory";

interface ChannelBubble {
  channel: string;
  inquiries: number;
  activations: number;
  conversion: number; // %
  margin: number; // 총 마진(원)
  byCat: { mobile: number; home: number; upsell: number };
}

const NEON = [
  "hsl(330 100% 60%)",
  "hsl(280 90% 65%)",
  "hsl(195 90% 60%)",
  "hsl(158 70% 55%)",
  "hsl(38 95% 60%)",
  "hsl(345 95% 65%)",
  "hsl(220 90% 65%)",
  "hsl(310 90% 65%)",
  "hsl(50 95% 60%)",
  "hsl(140 70% 55%)",
];

/**
 * 채널별 효율 분석
 * X축: 인입(문의) 건수 / Y축: 개통 전환율(%) / 버블 크기: 총 마진
 */
export const ChannelEfficiencyAnalysis = () => {
  const { startDate, endDate } = usePeriod();
  const [bubbles, setBubbles] = useState<ChannelBubble[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: salesRows }, { data: inquiryRows }] = await Promise.all([
        supabase
          .from("sales")
          .select("channel, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .limit(10000),
        supabase
          .from("inquiries")
          .select("channel")
          .gte("inquiry_date", startDate)
          .lte("inquiry_date", endDate)
          .limit(10000),
      ]);
      if (!alive) return;

      const map = new Map<string, ChannelBubble>();
      const ensure = (k: string) =>
        map.get(k) ??
        (map.set(k, { channel: k, inquiries: 0, activations: 0, conversion: 0, margin: 0 }), map.get(k)!);

      (inquiryRows ?? []).forEach((r: any) => {
        const k = r.channel || "기타";
        ensure(k).inquiries += 1;
      });
      (salesRows ?? []).forEach((r: any) => {
        const k = r.channel || "기타";
        const cur = ensure(k);
        cur.activations += 1;
        cur.margin +=
          (Number(r.net_fee) || 0) -
          (Number(r.distributor_amount) || 0) -
          (Number(r.cash_support_amount) || 0) -
          (Number(r.extra_subsidy) || 0);
      });

      const arr = Array.from(map.values()).map((b) => ({
        ...b,
        conversion: b.inquiries > 0 ? Math.round((b.activations / b.inquiries) * 1000) / 10 : 0,
      }));
      setBubbles(arr);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const sorted = useMemo(() => [...bubbles].sort((a, b) => b.margin - a.margin), [bubbles]);

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            채널별 효율 분석
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            X: 인입 · Y: 전환율(%) · 버블 크기 = 총 마진
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : bubbles.length === 0 ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">데이터가 없습니다</div>
      ) : (
        <>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="inquiries"
                  name="인입"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "인입(문의) →",
                    position: "insideBottom",
                    offset: -8,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="conversion"
                  name="전환율"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                  label={{
                    value: "전환율 ↑",
                    angle: -90,
                    position: "insideLeft",
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 11,
                  }}
                />
                <ZAxis type="number" dataKey="margin" range={[200, 2400]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: "0 8px 24px hsl(330 30% 30% / 0.15)",
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === "전환율") return [`${value}%`, name];
                    if (name === "인입") return [`${value}건`, name];
                    return [value, name];
                  }}
                  labelFormatter={(_, payload) => {
                    const p: any = payload?.[0]?.payload;
                    if (!p) return "";
                    return `📡 ${p.channel} · 개통 ${p.activations}건 · 마진 ${formatShortKRW(p.margin)}`;
                  }}
                />
                <Scatter data={bubbles}>
                  {bubbles.map((b, i) => (
                    <Cell
                      key={b.channel}
                      fill={NEON[i % NEON.length]}
                      fillOpacity={0.65}
                      stroke={NEON[i % NEON.length]}
                      strokeWidth={2}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* 채널별 요약 표 */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sorted.map((b, i) => (
              <div
                key={b.channel}
                className="rounded-xl p-3 bg-muted/40 border border-border/40"
                style={{ borderLeftColor: NEON[i % NEON.length], borderLeftWidth: 3 }}
              >
                <div className="text-xs font-semibold truncate">{b.channel}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  인입 {b.inquiries} · 개통 {b.activations}
                </div>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-[10px] text-muted-foreground">전환</span>
                  <span className="text-sm font-bold tabular-nums">{b.conversion}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] text-muted-foreground">마진</span>
                  <span className="text-xs font-semibold tabular-nums text-gradient">
                    {formatShortKRW(b.margin)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
