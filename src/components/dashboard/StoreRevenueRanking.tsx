import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { Trophy, ArrowRight, Crown, Medal } from "lucide-react";
import { formatShortKRW } from "@/data/mockData";
import { calcDashboardProfit } from "@/lib/profit";

interface StaffRow {
  uid: string;
  name: string;
  store: string;
  count: number;
  revenue: number;     // 판매수수료 + 상품권 금액
  expense: number;     // 오퍼/카드 추가지원금 + 모요 수수료
  profit: number;      // 순수익
}

/**
 * 개인별 순수익 랭킹 (전사 통합)
 * 순수익 = 확정 수익 항목 - 실질 지출 항목
 */
export const StoreRevenueRanking = () => {
  const { startDate, endDate } = usePeriod();
  const navigate = useNavigate();
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [salesRes, profilesRes] = await Promise.all([
        supabase
          .from("sales")
          .select("created_by, manager, channel, unit_price, vas_fee, receivable_amount, receivable_paid, voucher, voucher_returned, trade_in_enabled, trade_in_confirmed, distributor_amount, cash_support_amount, cash_open, extra_subsidy, customer_support_amount, corp_card_amount, custom_fields, moyo_excluded")
          .gte("open_date", startDate)
          .lte("open_date", endDate)
          .eq("status", "개통완료")
          .limit(10000),
        supabase
          .from("profiles")
          .select("user_id, display_name, store")
          .neq("status", "deleted"),
      ]);
      if (!alive) return;

      const profiles = profilesRes.data ?? [];
      const byId = new Map(profiles.map((p) => [p.user_id, p]));
      const byName = new Map<string, string>();
      profiles.forEach((p) => byName.set((p.display_name || "").trim().toLowerCase(), p.user_id));

      const ownerOf = (s: any): string => {
        const m = (s.manager ?? "").trim().toLowerCase();
        if (m && byId.has(m)) return m;
        if (m && byName.has(m)) return byName.get(m)!;
        return s.created_by;
      };

      const map = new Map<string, StaffRow>();
      (salesRes.data ?? []).forEach((r: any) => {
        const uid = ownerOf(r);
        if (!uid) return;
        const p = byId.get(uid);
        const name = p?.display_name ?? "미지정";
        const store = p?.store ?? "-";

        const { revenue, expense, profit } = calcDashboardProfit(r);

        const cur = map.get(uid) ?? { uid, name, store, count: 0, revenue: 0, expense: 0, profit: 0 };
        cur.count += 1;
        cur.revenue += revenue;
        cur.expense += expense;
        cur.profit += profit;
        map.set(uid, cur);
      });
      const sorted = Array.from(map.values()).sort((a, b) => b.profit - a.profit).slice(0, 10);
      setRows(sorted);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [startDate, endDate]);

  const max = Math.max(1, ...rows.map((r) => Math.abs(r.profit)));

  const getBarColor = (i: number) => {
    if (i === 0) return "linear-gradient(90deg, hsl(330 100% 55%), hsl(345 100% 65%))";
    if (i === 1) return "linear-gradient(90deg, hsl(280 90% 60%), hsl(310 90% 65%))";
    if (i === 2) return "linear-gradient(90deg, hsl(195 90% 55%), hsl(220 90% 60%))";
    return "linear-gradient(90deg, hsl(330 60% 50% / 0.6), hsl(330 60% 60% / 0.6))";
  };

  return (
    <div className="glass rounded-2xl p-6 shadow-card-elevated">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            개인별 순수익 랭킹
          </h3>
          <p className="text-xs text-muted-foreground mt-1">전사 통합 · 수익(수수료/수급/반납/중고폰) − 지출(지원금/5번 법인카드/모요)</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/30 font-bold">
          TOP 10
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">데이터가 없습니다</div>
      ) : (
        <div className="space-y-3">
          {rows.map((r, i) => {
            const widthPct = (Math.abs(r.profit) / max) * 100;
            const RankIcon = i === 0 ? Crown : i < 3 ? Medal : null;
            return (
              <button
                key={r.uid}
                onClick={() => navigate(`/activities?manager=${encodeURIComponent(r.name)}`)}
                className="w-full text-left group"
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-bold tabular-nums w-5 text-muted-foreground group-hover:text-primary transition-colors">
                      #{i + 1}
                    </span>
                    {RankIcon && <RankIcon className={`size-3.5 ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : "text-orange-400"}`} />}
                    <span className="font-semibold text-sm truncate">{r.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{r.store}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {r.count}건
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold text-sm tabular-nums ${r.profit < 0 ? "text-destructive" : "text-foreground"}`}>{formatShortKRW(r.profit)}</span>
                    <ArrowRight className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
                <div className="h-3 rounded-full bg-muted/60 overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(widthPct, 2)}%`,
                      background: getBarColor(i),
                      boxShadow: i < 3 ? `0 0 12px hsl(330 100% 55% / 0.4)` : undefined,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
