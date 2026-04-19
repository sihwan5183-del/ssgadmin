import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";

interface SpendResult {
  current: number;
  previous: number;
  delta: number; // % 변화
  loading: boolean;
}

/**
 * 선택된 기간 동안의 총 마케팅 지출
 *  = ad_spend.amount 합계 (spend_date in range)
 *  + ad_campaigns 일할 광고비 (총예산 ÷ 캠페인 일수 × 기간 내 겹치는 일수)
 *
 * ad_campaigns 또는 ad_spend가 변경되면 Realtime으로 자동 재계산.
 */
export const useMarketingSpend = (): SpendResult => {
  const { startDate, endDate, prevStartDate, prevEndDate } = usePeriod();
  const [state, setState] = useState<SpendResult>({
    current: 0,
    previous: 0,
    delta: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const calcCampaignOverlap = (
      rows: { start_date: string; end_date: string; total_budget: number }[],
      rangeStart: string,
      rangeEnd: string,
    ) => {
      const rs = new Date(rangeStart).getTime();
      const re = new Date(rangeEnd).getTime();
      let total = 0;
      for (const c of rows) {
        const cs = new Date(c.start_date).getTime();
        const ce = new Date(c.end_date).getTime();
        const totalDays = Math.max(1, Math.round((ce - cs) / 86400000) + 1);
        const ovStart = Math.max(cs, rs);
        const ovEnd = Math.min(ce, re);
        if (ovEnd < ovStart) continue;
        const overlapDays = Math.round((ovEnd - ovStart) / 86400000) + 1;
        total += ((c.total_budget || 0) / totalDays) * overlapDays;
      }
      return total;
    };

    const fetchRange = async (s: string, e: string) => {
      const [spendRes, campRes] = await Promise.all([
        supabase
          .from("ad_spend")
          .select("amount")
          .gte("spend_date", s)
          .lte("spend_date", e),
        supabase
          .from("ad_campaigns")
          .select("start_date,end_date,total_budget")
          .lte("start_date", e)
          .gte("end_date", s),
      ]);
      const spendSum = (spendRes.data ?? []).reduce(
        (a, r) => a + Number(r.amount || 0),
        0,
      );
      const campSum = calcCampaignOverlap(
        (campRes.data ?? []) as any,
        s,
        e,
      );
      return spendSum + campSum;
    };

    const run = async () => {
      setState((p) => ({ ...p, loading: true }));
      const [cur, prev] = await Promise.all([
        fetchRange(startDate, endDate),
        fetchRange(prevStartDate, prevEndDate),
      ]);
      if (cancelled) return;
      const delta = prev > 0 ? ((cur - prev) / prev) * 100 : 0;
      setState({ current: cur, previous: prev, delta, loading: false });
    };

    run();

    // Realtime 구독 — 캠페인/지출 변경 시 자동 재계산
    const channel = supabase
      .channel("marketing-spend-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_campaigns" },
        () => run(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ad_spend" },
        () => run(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [startDate, endDate, prevStartDate, prevEndDate]);

  return state;
};
