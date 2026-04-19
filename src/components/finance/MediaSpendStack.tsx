import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
  Line, LineChart,
} from "recharts";
import {
  mediaWeekly, mediaList, mediaPalette, channelEconomics,
  formatKRWShort, formatM,
} from "@/data/financeData";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";

type ViewMode = "daily" | "weekly";

const pad = (n: number) => String(n).padStart(2, "0");

export const MediaSpendStack = () => {
  const { startDate, endDate } = usePeriod();
  const [view, setView] = useState<ViewMode>("daily");
  const [daily, setDaily] = useState<any[]>([]);
  const [media, setMedia] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("ad_spend")
        .select("spend_date, media, amount")
        .gte("spend_date", startDate)
        .lte("spend_date", endDate);

      const mediaSet = new Set<string>();
      const buckets = new Map<string, Record<string, any>>();
      const start = new Date(startDate + "T00:00:00");
      const end = new Date(endDate + "T00:00:00");
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        buckets.set(iso, {
          date: iso,
          day: `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
        });
      }
      (data ?? []).forEach((r: any) => {
        const b = buckets.get(r.spend_date);
        if (!b) return;
        const m = r.media ?? "기타";
        mediaSet.add(m);
        b[m] = (b[m] ?? 0) + Number(r.amount ?? 0);
      });
      setMedia(Array.from(mediaSet));
      setDaily(Array.from(buckets.values()));
      setLoading(false);
    })();
  }, [startDate, endDate]);

  // Daily totals (real)
  const dailyData = daily;
  // Fall back to mock weekly when DB empty
  const hasReal = useMemo(
    () => daily.some((d) => media.some((m) => Number(d[m] ?? 0) > 0)),
    [daily, media],
  );
  const usedMedia = hasReal ? media : mediaList;
  const usedDaily = hasReal ? dailyData : null;

  const totalByMedia = (hasReal ? media : mediaList).map((m) => ({
    name: m,
    total: hasReal
      ? daily.reduce((s, d) => s + Number(d[m] ?? 0), 0)
      : mediaWeekly.reduce((s, w) => s + (w as any)[m], 0),
  }));
  const grand = totalByMedia.reduce((s, m) => s + m.total, 0);

  const totalByDay = (usedDaily ?? []).map((d) => ({
    day: d.day,
    total: usedMedia.reduce((s, m) => s + Number(d[m] ?? 0), 0),
  }));

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h4 className="text-base font-semibold tracking-tight">채널별 광고비 집행 현황</h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {view === "daily" ? "일별 매체별 집행 (단위: 원)" : "매체 × 주차 누적 (단위: 원)"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasReal && (
            <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
              {(["daily", "weekly"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    view === v ? "bg-primary/20 text-primary-glow" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "daily" ? "일별" : "주별"}
                </button>
              ))}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            총 집행 <span className="text-expense font-bold text-sm">{formatKRWShort(grand)}</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">불러오는 중…</div>
        ) : view === "daily" && hasReal ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatM(v)} />
              <Tooltip
                cursor={{ fill: "hsl(var(--expense) / 0.08)" }}
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12, fontSize: 12,
                }}
                formatter={(v: number, n) => [formatKRWShort(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
              {usedMedia.map((m, i) => (
                <Bar
                  key={m}
                  dataKey={m}
                  stackId="spend"
                  fill={mediaPalette[m] ?? `hsl(${(i * 50) % 360} 70% 55%)`}
                  radius={i === usedMedia.length - 1 ? [8, 8, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mediaWeekly} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => formatM(v)} />
              <Tooltip
                cursor={{ fill: "hsl(var(--expense) / 0.08)" }}
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12, fontSize: 12,
                }}
                formatter={(v: number, n) => [formatKRWShort(v), n]}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" />
              {mediaList.map((m, i) => (
                <Bar
                  key={m}
                  dataKey={m}
                  stackId="spend"
                  fill={mediaPalette[m]}
                  radius={i === mediaList.length - 1 ? [8, 8, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {view === "daily" && hasReal && totalByDay.length > 0 && (
        <div className="mt-4 h-24">
          <div className="text-[11px] text-muted-foreground mb-1">일별 총 지출 라인</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={totalByDay} margin={{ top: 4, right: 6, left: -10, bottom: 0 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  background: "hsl(240 18% 8% / 0.95)",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 12, fontSize: 12,
                }}
                formatter={(v: number) => [formatKRWShort(v), "총 지출"]}
              />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--expense))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 md:grid-cols-6 gap-2">
        {totalByMedia
          .sort((a, b) => b.total - a.total)
          .map((m) => (
            <div key={m.name} className="rounded-xl bg-card/40 border border-border/40 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="size-2 rounded-full" style={{ background: mediaPalette[m.name] ?? "hsl(var(--expense))" }} />
                <span className="text-muted-foreground">{m.name}</span>
              </div>
              <div className="mt-1 text-sm font-bold text-expense tabular-nums">{formatKRWShort(m.total)}</div>
            </div>
          ))}
      </div>

      {/* CPA 미니 표 — 빠른 참고 */}
      <div className="mt-5 pt-4 border-t border-border/40">
        <div className="text-xs text-muted-foreground mb-2">CPA 빠른 참고 · 광고비 ÷ 성공건수</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {channelEconomics.slice(0, 6).map((c) => {
            const cpa = Math.round(c.spend / c.successCount);
            return (
              <div key={c.channel} className="flex items-center justify-between rounded-lg bg-card/30 border border-border/40 px-3 py-2">
                <span className="text-xs">{c.channel}</span>
                <span className="text-sm font-bold tabular-nums text-expense">{formatKRWShort(cpa)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
