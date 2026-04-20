import { useEffect, useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

const TYPE_COLORS: Record<string, string> = {
  "MNP": "hsl(195 90% 60%)",
  "신규": "hsl(160 80% 50%)",
  "기변": "hsl(270 90% 65%)",
  "USIM MNP": "hsl(35 95% 60%)",
};
const PALETTE = ["hsl(195 90% 60%)", "hsl(270 90% 65%)", "hsl(160 80% 50%)", "hsl(35 95% 60%)", "hsl(320 90% 65%)", "hsl(0 80% 60%)"];

export const MobileBreakdown = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("sales")
        .select("sale_type, device_model, product")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!alive) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const subscriptionTypes = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const t = r.sale_type || "기타";
      map.set(t, (map.get(t) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([type, count], i) => ({
        type,
        count,
        color: TYPE_COLORS[type] ?? PALETTE[i % PALETTE.length],
        desc: type === "MNP" ? "번호이동" : type === "기변" ? "기기변경" : "",
      }))
      .sort((a, b) => b.count - a.count);
  }, [rows]);

  const modelShare = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      if (!r.device_model) return;
      map.set(r.device_model, (map.get(r.device_model) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [rows]);

  const totalSub = subscriptionTypes.reduce((s, t) => s + t.count, 0);
  const totalModel = modelShare.reduce((s, m) => s + m.value, 0);
  const topPct = totalModel > 0 && modelShare[0] ? Math.round((modelShare[0].value / totalModel) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* 가입 유형별 */}
      <div className="glass rounded-2xl p-5 lg:col-span-2">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h4 className="text-base font-semibold tracking-tight">가입 유형별 실적</h4>
            <p className="text-xs text-muted-foreground mt-0.5">번호이동 · 신규 · 기변 구분</p>
          </div>
          <div className="text-xs text-muted-foreground">
            합계 <span className="text-foreground font-semibold tabular-nums">{totalSub}건</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">불러오는 중…</div>
        ) : subscriptionTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">데이터가 없습니다</div>
        ) : (
          <div className="space-y-3">
            {subscriptionTypes.map((t) => {
              const pct = totalSub > 0 ? Math.round((t.count / totalSub) * 100) : 0;
              return (
                <div key={t.type}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full" style={{ background: t.color }} />
                      <span className="font-medium">{t.type}</span>
                      {t.desc && <span className="text-[11px] text-muted-foreground">{t.desc}</span>}
                    </div>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span className="text-muted-foreground text-xs">{pct}%</span>
                      <span className="font-semibold">{t.count}건</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: t.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TOP 모델 비중 */}
      <div className="glass rounded-2xl p-5">
        <h4 className="text-base font-semibold tracking-tight">TOP 모델 비중</h4>
        <p className="text-xs text-muted-foreground mt-0.5">기간 내 판매 상위 6개</p>

        <div className="relative h-40 mt-2">
          {modelShare.length === 0 ? (
            <div className="h-full grid place-items-center text-xs text-muted-foreground">데이터 없음</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={modelShare} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">
                    {modelShare.map((m) => <Cell key={m.name} fill={m.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(240 18% 8% / 0.95)", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => `${v}건`}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-[10px] text-muted-foreground">1위</div>
                  <div className="text-xl font-bold text-gradient">{topPct}%</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="space-y-1.5 text-sm mt-2">
          {modelShare.map((m) => (
            <div key={m.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="size-2 rounded-full shrink-0" style={{ background: m.color }} />
                <span className="truncate">{m.name}</span>
              </div>
              <span className="tabular-nums text-muted-foreground shrink-0 ml-2">{m.value}건</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
