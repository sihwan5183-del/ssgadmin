import { useEffect, useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { formatShortKRW } from "@/data/mockData";
import { TrendingUp, Layers, Tag } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  /** profile.user_id 또는 fallback 으로 사용된 이름 */
  personKey: string | null;
  personName: string | null;
}

/**
 * 개인 성과 드릴다운 — 채널 / 가입유형(번호이동/기변) 별 수익 분포
 */
export const PersonPerformanceDrawer = ({ open, onClose, personKey, personName }: Props) => {
  const { startDate, endDate } = usePeriod();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !personKey) return;
    let alive = true;
    (async () => {
      setLoading(true);
      // personKey 가 uuid 형식이면 created_by 로, 아니면 manager 로 매칭
      const isUuid = /^[0-9a-f-]{36}$/i.test(personKey);
      let q = supabase
        .from("sales")
        .select("channel, sale_type, net_fee, distributor_amount, cash_support_amount, extra_subsidy")
        .gte("open_date", startDate)
        .lte("open_date", endDate)
        .limit(5000);
      q = isUuid ? q.eq("created_by", personKey) : q.eq("manager", personKey);
      const { data } = await q;
      if (!alive) return;
      setRows(data ?? []);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open, personKey, startDate, endDate]);

  const { byChannel, bySaleType, total, count } = useMemo(() => {
    const ch = new Map<string, { count: number; profit: number }>();
    const st = new Map<string, { count: number; profit: number }>();
    let total = 0;
    rows.forEach((r) => {
      const profit =
        (Number(r.net_fee) || 0) -
        (Number(r.distributor_amount) || 0) -
        (Number(r.cash_support_amount) || 0) -
        (Number(r.extra_subsidy) || 0);
      total += profit;
      const cKey = r.channel || "미지정";
      const sKey = r.sale_type || "미지정";
      const c = ch.get(cKey) ?? { count: 0, profit: 0 };
      c.count += 1;
      c.profit += profit;
      ch.set(cKey, c);
      const s = st.get(sKey) ?? { count: 0, profit: 0 };
      s.count += 1;
      s.profit += profit;
      st.set(sKey, s);
    });
    return {
      byChannel: Array.from(ch.entries())
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.profit - a.profit),
      bySaleType: Array.from(st.entries())
        .map(([k, v]) => ({ key: k, ...v }))
        .sort((a, b) => b.profit - a.profit),
      total,
      count: rows.length,
    };
  }, [rows]);

  const maxChannelProfit = Math.max(1, ...byChannel.map((r) => Math.abs(r.profit)));
  const maxTypeProfit = Math.max(1, ...bySaleType.map((r) => Math.abs(r.profit)));

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            {personName ?? "개인"} 성과 상세
          </SheetTitle>
          <SheetDescription>선택 기간의 채널/가입유형별 수익 분포</SheetDescription>
        </SheetHeader>

        {/* 요약 */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="text-[10px] text-muted-foreground">총 순이익</div>
            <div className="text-xl font-bold text-gradient mt-1">{formatShortKRW(total)}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="text-[10px] text-muted-foreground">개통 건수</div>
            <div className="text-xl font-bold mt-1 tabular-nums">{count.toLocaleString()}건</div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-sm text-muted-foreground text-center">불러오는 중…</div>
        ) : count === 0 ? (
          <div className="py-12 text-sm text-muted-foreground text-center">해당 기간 데이터가 없습니다</div>
        ) : (
          <>
            {/* 채널별 */}
            <section className="mt-6">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Layers className="size-4 text-primary" /> 채널별 수익
              </h4>
              <div className="space-y-2">
                {byChannel.map((r) => {
                  const w = (Math.abs(r.profit) / maxChannelProfit) * 100;
                  return (
                    <div key={r.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{r.key}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {r.count}건 · <span className="text-foreground font-semibold">{formatShortKRW(r.profit)}</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(w, 2)}%`,
                            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.6))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 가입유형 */}
            <section className="mt-6">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Tag className="size-4 text-primary" /> 가입유형별 수익
              </h4>
              <div className="space-y-2">
                {bySaleType.map((r) => {
                  const w = (Math.abs(r.profit) / maxTypeProfit) * 100;
                  return (
                    <div key={r.key}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">{r.key}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {r.count}건 · <span className="text-foreground font-semibold">{formatShortKRW(r.profit)}</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(w, 2)}%`,
                            background: "linear-gradient(90deg, hsl(280 90% 60%), hsl(330 90% 60%))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
