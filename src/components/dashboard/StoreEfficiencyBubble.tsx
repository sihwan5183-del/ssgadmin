import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

interface Bubble {
  store: string;
  count: number;
  margin: number;
  total: number;
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
];

/**
 * 매장 효율 버블 차트
 * X축: 판매 건수 / Y축: 건당 평균 마진 / 버블 크기: 총 수익
 * 우상단 = 박리다매 효율 매장 / 좌상단 = 내실형 / 우하단 = 박리저마진
 */
export const StoreEfficiencyBubble = () => {
  const { startDate, endDate } = usePeriod();
  const navigate = useNavigate();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("manager, net_fee, distributor_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .eq("status", "개통완료")
        .limit(2000);
      if (!alive) return;

      const map = new Map<string, { count: number; total: number }>();
      (data ?? []).forEach((r: any) => {
        const key = r.manager || "미지정";
        const profit =
          (Number(r.net_fee) || 0) - (Number(r.distributor_amount) || 0) - (Number(r.extra_subsidy) || 0);
        const cur = map.get(key) ?? { count: 0, total: 0 };
        cur.count += 1;
        cur.total += profit;
        map.set(key, cur);
      });
      const arr = Array.from(map.entries()).map(([store, v]) => ({
        store,
        count: v.count,
        total: v.total,
        margin: v.count > 0 ? Math.round(v.total / v.count) : 0,
      }));
      setBubbles(arr.slice(0, 12));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const maxTotal = useMemo(() => Math.max(1, ...bubbles.map((b) => Math.abs(b.total))), [bubbles]);

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            매장 효율 분석 (건수 × 건당 마진)
          </h3>
          <p className="text-xs text-muted-foreground mt-1">우상단일수록 내실 있는 매장 · 버블 크기 = 총 수익</p>
        </div>
      </div>

      {loading ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
      ) : bubbles.length === 0 ? (
        <div className="h-72 grid place-items-center text-sm text-muted-foreground">데이터가 없습니다</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                dataKey="count"
                name="판매건수"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                label={{ value: "판매 건수 →", position: "insideBottom", offset: -8, fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="margin"
                name="건당 마진"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${Math.round(v / 10000)}만`}
                label={{ value: "건당 마진 ↑", angle: -90, position: "insideLeft", fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              />
              <ZAxis type="number" dataKey="total" range={[200, 2400]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "hsl(0 0% 100% / 0.96)",
                  color: "#374151",
                  border: "1px solid hsl(0 0% 88%)",
                  borderRadius: 12,
                  fontSize: 12,
                  boxShadow: "0 4px 20px hsl(0 0% 0% / 0.10)",
                  padding: "8px 12px",
                }}
                formatter={(value: any, name: string) => {
                  if (name === "건당 마진" || name === "총수익") return [Number(value).toLocaleString() + "원", name];
                  return [value, name];
                }}
                labelFormatter={(_, payload) => (payload?.[0]?.payload?.store ? `🏬 ${payload[0].payload.store}` : "")}
              />
              <Scatter
                data={bubbles}
                onClick={(d: any) => d?.store && navigate(`/activities?manager=${encodeURIComponent(d.store)}`)}
                cursor="pointer"
              >
                {bubbles.map((b, i) => (
                  <Cell
                    key={b.store}
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
      )}
    </div>
  );
};
