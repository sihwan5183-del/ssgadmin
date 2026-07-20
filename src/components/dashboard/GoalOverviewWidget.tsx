import { useEffect, useState, useMemo, useCallback } from "react";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePeriod } from "@/contexts/PeriodContext";
import { cn } from "@/lib/utils";

// 대시보드용 "전체 목표 현황" 위젯 (2026-07 추가) -- RadialGoalGauge가
// 모바일 하나만 보여주는 것과 별개로, 직원별 목표 셋팅에서 관리하는 5개
// 항목(모바일/2ND/인터넷/TV프리/맞춤제안) 전사 합계를 막대그래프 리스트로
// 한 번에 보여준다. RadialGoalGauge와 동일하게 Realtime 구독으로 자동
// 갱신됨 (새로고침 불필요).
//
// 항목 정의는 StaffGoalsPage.tsx의 app_settings.staff_goal_mapping과
// 반드시 일치해야 한다 -- 이 위젯은 app_settings에서 항목 목록 자체도
// 동적으로 읽어오므로, 나중에 항목이 추가/삭제되면 자동으로 반영된다.
const CUSTOM_PROPOSAL_KEY = "custom_proposal";

interface MappingItem {
  key: string;
  label: string;
  products: string[];
}

interface ItemStat {
  key: string;
  label: string;
  current: number;
  target: number;
}

export const GoalOverviewWidget = () => {
  const { year, month } = usePeriod();
  const [mapping, setMapping] = useState<MappingItem[]>([]);
  const [stats, setStats] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(true);

  const yearMonth = useMemo(() => {
    const m = month && month >= 1 && month <= 12 ? month : new Date().getMonth() + 1;
    const y = year || new Date().getFullYear();
    return `${y}-${String(m).padStart(2, "0")}`;
  }, [year, month]);

  const monthStart = `${yearMonth}-01`;
  const monthEnd = useMemo(() => {
    const [y, m] = yearMonth.split("-").map(Number);
    return new Date(y, m, 0).toISOString().slice(0, 10);
  }, [yearMonth]);

  const loadMapping = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "staff_goal_mapping")
      .maybeSingle();
    const items = ((data?.value as any)?.items ?? []) as MappingItem[];
    setMapping(items);
  }, []);

  const load = useCallback(async () => {
    if (mapping.length === 0) return;
    setLoading(true);

    // 항목별 전사 목표 합계 (팀 통합 목표 기준)
    const { data: goalRows } = await supabase
      .from("team_product_goals")
      .select("product, goal_count")
      .eq("year_month", yearMonth)
      .eq("goal_type", "count");
    const targetByKey: Record<string, number> = {};
    (goalRows ?? []).forEach((g: any) => {
      targetByKey[g.product] = (targetByKey[g.product] ?? 0) + Number(g.goal_count ?? 0);
    });

    // 항목별 전사 실적 합계 -- sales 기반 항목은 product 문자열 매칭,
    // 맞춤제안은 custom_proposals 테이블 건수 그대로.
    const salesMapping = mapping.filter((m) => m.key !== CUSTOM_PROPOSAL_KEY);
    const [{ data: salesRows }, { count: proposalCount }] = await Promise.all([
      supabase
        .from("sales")
        .select("product")
        .gte("open_date", monthStart)
        .lte("open_date", monthEnd),
      mapping.some((m) => m.key === CUSTOM_PROPOSAL_KEY)
        ? supabase
            .from("custom_proposals")
            .select("id", { count: "exact", head: true })
            .gte("change_date", monthStart)
            .lte("change_date", monthEnd)
        : Promise.resolve({ count: 0 } as any),
    ]);

    const currentByKey: Record<string, number> = {};
    (salesRows ?? []).forEach((s: any) => {
      const v = (s.product ?? "").toString().trim();
      if (!v) return;
      for (const m of salesMapping) {
        if (m.products.some((p) => v.includes(p) || p.includes(v))) {
          currentByKey[m.key] = (currentByKey[m.key] ?? 0) + 1;
          break;
        }
      }
    });
    if (mapping.some((m) => m.key === CUSTOM_PROPOSAL_KEY)) {
      currentByKey[CUSTOM_PROPOSAL_KEY] = proposalCount ?? 0;
    }

    setStats(
      mapping.map((m) => ({
        key: m.key,
        label: m.label,
        current: currentByKey[m.key] ?? 0,
        target: targetByKey[m.key] ?? 0,
      }))
    );
    setLoading(false);
  }, [mapping, yearMonth, monthStart, monthEnd]);

  useEffect(() => { loadMapping(); }, [loadMapping]);
  useEffect(() => { load(); }, [load]);

  // 실시간 갱신: sales/custom_proposals/team_product_goals 중 하나라도
  // 바뀌면 다시 집계 (RadialGoalGauge와 동일한 패턴).
  useEffect(() => {
    const ch = supabase
      .channel("goal-overview-widget-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_proposals" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_product_goals" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  return (
    <div className="h-full w-full flex flex-col bg-card rounded-xl border border-border/60 shadow-sm p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 mb-3">
        <Target className="size-3.5 text-primary" />
        {yearMonth} 전체 목표 현황
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">불러오는 중…</div>
      ) : stats.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground text-center px-4">
          목표 항목이 설정되지 않았습니다.<br />직원별 목표 셋팅 → 항목 관리에서 등록하세요.
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto">
          {stats.map((s) => {
            const pct = s.target > 0 ? Math.min(100, Math.round((s.current / s.target) * 100)) : 0;
            const color =
              s.target === 0 ? "bg-muted-foreground/30" :
              pct >= 100 ? "bg-emerald-500" :
              pct >= 51 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-foreground">{s.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {s.target > 0 ? (
                      <>
                        <span className="font-semibold text-foreground">{s.current}</span> / {s.target}건
                        <span className="ml-1 font-bold">{pct}%</span>
                      </>
                    ) : (
                      <span className="italic">목표 미설정 (실적 {s.current}건)</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full transition-all", color)}
                    style={{ width: `${s.target > 0 ? pct : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
