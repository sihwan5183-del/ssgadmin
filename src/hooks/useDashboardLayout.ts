import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type WidgetConfig = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
};

export const WIDGET_REGISTRY: { id: string; label: string }[] = [
  { id: "review_alerts", label: "검수 피드백 알림" },
  { id: "quick_links", label: "업무 바로가기" },
  { id: "goal_gauge", label: "목표 달성률 게이지" },
  { id: "hero_performance", label: "핵심 실적 지표" },
  { id: "channel_activation", label: "채널별 개통 현황" },
  { id: "activation_breakdown", label: "모바일 유형별 건수" },
  { id: "stat_cards", label: "수익 요약 카드 (순이익/리베이트/마케팅)" },
  { id: "performance_chart", label: "실적 추이 차트" },
  { id: "channel_donut", label: "인입 경로별 비중 (도넛)" },
  { id: "store_ranking", label: "매장별 매출 순위" },
  { id: "store_efficiency", label: "매장 효율 버블" },
  { id: "performance_ledger", label: "실적 원장" },
  { id: "overall_model", label: "전체 기종 분석" },
  { id: "channel_model", label: "채널별 기종 분석" },
  { id: "live_feed", label: "라이브 활동 피드" },
  { id: "planner_feed", label: "기획팀 피드" },
  { id: "inventory_widget", label: "재고 현황" },
  { id: "strategy_gauges", label: "전략 모델 게이지" },
  { id: "ad_schedule", label: "광고 일정" },
  { id: "ranking_panel", label: "랭킹 패널" },
];

const SETTINGS_KEY = "dashboard.layout";

export function useDashboardLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(
    WIDGET_REGISTRY.map((w, i) => ({ ...w, visible: true, order: i }))
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SETTINGS_KEY)
        .maybeSingle();
      if (data?.value && Array.isArray(data.value)) {
        const saved = data.value as WidgetConfig[];
        // Merge: keep saved config, add any new widgets from registry
        const savedMap = new Map(saved.map((w) => [w.id, w]));
        const merged = WIDGET_REGISTRY.map((reg, i) => {
          const s = savedMap.get(reg.id);
          return s ? { ...reg, ...s } : { ...reg, visible: true, order: i + saved.length };
        }).sort((a, b) => a.order - b.order);
        setWidgets(merged);
      }
      setLoaded(true);
    })();
  }, []);

  const save = useCallback(async (cfg: WidgetConfig[]) => {
    setWidgets(cfg);
    await supabase.from("app_settings").upsert(
      { key: SETTINGS_KEY, value: cfg as any },
      { onConflict: "key" }
    );
  }, []);

  const isVisible = useCallback(
    (id: string) => widgets.find((w) => w.id === id)?.visible ?? true,
    [widgets]
  );

  const toggle = useCallback(
    (id: string) => {
      const next = widgets.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
      save(next);
    },
    [widgets, save]
  );

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      const arr = [...widgets];
      const idx = arr.findIndex((w) => w.id === id);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= arr.length) return;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      save(arr.map((w, i) => ({ ...w, order: i })));
    },
    [widgets, save]
  );

  const resetToDefault = useCallback(() => {
    const def = WIDGET_REGISTRY.map((w, i) => ({ ...w, visible: true, order: i }));
    save(def);
  }, [save]);

  return { widgets, loaded, isVisible, toggle, move, save, resetToDefault };
}