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
  { id: "today_care", label: "오늘의 관리 고객 (요금제·부가서비스)" },
  { id: "quick_links", label: "업무 바로가기" },
  { id: "goal_gauge", label: "목표 달성률 게이지" },
  { id: "goal_overview", label: "전체 목표 현황 (모바일/2ND/인터넷/TV프리/맞춤제안)" },
  { id: "hero_performance", label: "핵심 실적 지표" },
  { id: "channel_activation", label: "채널별 개통 현황" },
  { id: "activation_breakdown", label: "모바일 유형별 건수" },
  { id: "stat_cards", label: "수익 요약 카드 (순이익/리베이트/마케팅)" },
  { id: "settlement_charts", label: "수익/지출 현황 차트" },
  { id: "untreated_leads", label: "신규 미처리 건수" },
  { id: "performance_chart", label: "실적 추이 차트" },
  { id: "channel_donut", label: "인입 경로별 비중 (도넛)" },
  { id: "store_ranking", label: "개인별 순수익 랭킹" },
  { id: "store_efficiency", label: "채널별 효율 분석" },
  { id: "staff_matrix", label: "개인별 실적 현황 (상품 매트릭스)" },
  { id: "performance_ledger", label: "실적 원장" },
  { id: "overall_model", label: "전체 기종 분석" },
  { id: "channel_model", label: "채널별 기종 분석" },
  { id: "live_feed", label: "라이브 활동 피드" },
  { id: "planner_feed", label: "기획팀 피드" },
  { id: "inventory_widget", label: "재고 현황" },
  { id: "strategy_gauges", label: "전략 모델 게이지" },
  { id: "ad_schedule", label: "광고 일정" },
  { id: "ranking_panel", label: "랭킹 패널" },
  { id: "my_incentive", label: "나의 예상 인센티브" },
  { id: "top_product", label: "핵심 상품 성과 보드" },
  { id: "pending_product", label: "미개통 대기 상품 보드" },
  { id: "unified_calendar", label: "일별 판매실적 캘린더" },
];

// 깔끔한 첫 진입을 위해 기본값을 OFF 로 두는 헤비 위젯
const DEFAULT_OFF: ReadonlySet<string> = new Set([
  "performance_ledger",
  "overall_model",
  "channel_model",
  "ranking_panel",
]);

const SETTINGS_KEY = "dashboard.layout";

const buildDefault = (): WidgetConfig[] =>
  WIDGET_REGISTRY.map((w, i) => ({ ...w, visible: !DEFAULT_OFF.has(w.id), order: i }));

// ── 모듈 레벨 싱글톤 스토어 (모든 useDashboardLayout 인스턴스가 공유)
let _state: WidgetConfig[] = buildDefault();
let _loaded = false;
let _loading: Promise<void> | null = null;
const _subs = new Set<() => void>();
const _emit = () => _subs.forEach((fn) => fn());

const mergeRegistry = (saved: WidgetConfig[]): WidgetConfig[] => {
  const map = new Map(saved.map((w) => [w.id, w]));
  return WIDGET_REGISTRY.map((reg, i) => {
    const s = map.get(reg.id);
    return s
      ? { ...reg, visible: s.visible, order: s.order ?? i }
      : { ...reg, visible: !DEFAULT_OFF.has(reg.id), order: i + saved.length };
  }).sort((a, b) => a.order - b.order);
};

const loadOnce = () => {
  if (_loading) return _loading;
  _loading = (async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();
    if (data?.value && Array.isArray(data.value)) {
      _state = mergeRegistry(data.value as WidgetConfig[]);
    }
    _loaded = true;
    _emit();
  })();
  return _loading;
};

const persist = async (cfg: WidgetConfig[]) => {
  _state = cfg;
  _emit();
  await supabase
    .from("app_settings")
    .upsert({ key: SETTINGS_KEY, value: cfg as any }, { onConflict: "key" });
};

export function useDashboardLayout(editable = false) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(_state);
  const [loaded, setLoadedLocal] = useState<boolean>(_loaded);

  useEffect(() => {
    const sync = () => {
      setWidgets([..._state]);
      setLoadedLocal(_loaded);
    };
    _subs.add(sync);
    loadOnce().then(sync);
    return () => {
      _subs.delete(sync);
    };
  }, []);

  const isVisible = useCallback(
    (id: string) => widgets.find((w) => w.id === id)?.visible ?? !DEFAULT_OFF.has(id),
    [widgets],
  );

  const toggle = useCallback((id: string) => {
    if (!editable) return;
    persist(_state.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w)));
  }, [editable]);

  const move = useCallback((id: string, dir: -1 | 1) => {
    if (!editable) return;
    const arr = [..._state];
    const idx = arr.findIndex((w) => w.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    persist(arr.map((w, i) => ({ ...w, order: i })));
  }, [editable]);

  const save = useCallback((cfg: WidgetConfig[]) => {
    if (!editable) return;
    persist(cfg);
  }, [editable]);

  const resetToDefault = useCallback(() => {
    if (!editable) return;
    persist(buildDefault());
  }, [editable]);

  return { widgets, loaded, isVisible, toggle, move, save, resetToDefault };
}
