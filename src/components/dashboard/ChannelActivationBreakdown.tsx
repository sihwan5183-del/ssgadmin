import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Radio, Flame, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";

type ProductFilter = "전체" | "모바일" | "홈" | "업셀" | "IoT";

const PRODUCT_FILTERS: ProductFilter[] = ["전체", "모바일", "홈", "업셀", "IoT"];

// 상품 카테고리 매칭 규칙 (sales.product 값 기준)
const matchesProduct = (product: string | null | undefined, filter: ProductFilter): boolean => {
  if (filter === "전체") return true;
  const p = (product ?? "").trim();
  switch (filter) {
    case "모바일":
      return p === "모바일" || p === "USIM MNP" || p === "세컨";
    case "홈":
      return p === "인터넷" || p === "TV프리" || p === "홈";
    case "업셀":
      return p === "대명";
    case "IoT":
      return p === "IOT" || p.toLowerCase() === "iot";
    default:
      return false;
  }
};

const CHANNEL_COLORS: Record<string, string> = {
  "당근": "hsl(35 95% 60%)",
  "유닥": "hsl(35 95% 60%)",
  "모요": "hsl(270 90% 65%)",
  "도그마루": "hsl(320 90% 65%)",
  "오프라인": "hsl(195 90% 60%)",
  "캠페인": "hsl(160 80% 50%)",
  "기타": "hsl(0 0% 60%)",
};

const colorFor = (name: string, idx: number) => {
  if (CHANNEL_COLORS[name]) return CHANNEL_COLORS[name];
  const palette = Object.values(CHANNEL_COLORS);
  return palette[idx % palette.length];
};

export const ChannelActivationBreakdown = () => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<{ channel: string; monthly: number; today: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const todayISO = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("sales")
        .select("channel, open_date")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(10000);
      if (!alive) return;
      const map = new Map<string, { monthly: number; today: number }>();
      (data ?? []).forEach((r: any) => {
        const ch = r.channel || "기타";
        const cur = map.get(ch) ?? { monthly: 0, today: 0 };
        cur.monthly += 1;
        if (r.open_date === todayISO) cur.today += 1;
        map.set(ch, cur);
      });
      const list = Array.from(map.entries())
        .map(([channel, v]) => ({ channel, ...v }))
        .sort((a, b) => b.monthly - a.monthly);
      setRows(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [startDate, endDate]);

  const totalMonthly = useMemo(() => rows.reduce((s, r) => s + r.monthly, 0), [rows]);
  const totalToday = useMemo(() => rows.reduce((s, r) => s + r.today, 0), [rows]);
  const maxMonthly = Math.max(1, ...rows.map((r) => r.monthly));
  const topToday = [...rows].sort((a, b) => b.today - a.today)[0];

  return (
    <section className="mb-6">
      <Card className="p-6 glass">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-secondary/10 grid place-items-center">
              <Radio className="size-4 text-secondary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">채널별 개통 현황</h3>
              <p className="text-[11px] text-muted-foreground">
                인입 경로별 당월 누적 · 오늘 개통
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">당월 합계</div>
              <div className="font-bold tabular-nums text-lg">
                {totalMonthly.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">오늘 합계</div>
              <div className="font-bold tabular-nums text-lg text-primary">
                {totalToday.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">건</span>
              </div>
            </div>
            {topToday && topToday.today > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Flame className="size-3.5" />
                오늘 1위 · {topToday.channel}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">선택한 기간 내 데이터가 없습니다</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {rows.map((row, idx) => {
              const ratio = (row.monthly / maxMonthly) * 100;
              const color = colorFor(row.channel, idx);
              return (
                <div
                  key={row.channel}
                  className="p-4 rounded-xl border border-border/50 bg-background/40 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="size-2 rounded-full" style={{ background: color }} />
                    <span className="text-xs font-medium">{row.channel}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold tabular-nums">{row.monthly}</span>
                    <span className="text-[11px] text-muted-foreground">건 누적</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-sm font-semibold tabular-nums text-primary">+{row.today}</span>
                    <span className="text-[11px] text-muted-foreground">오늘</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ratio}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
};
