import { useState, useCallback } from "react";
import type { LayoutItem } from "react-grid-layout";

/* ── widget registry ── */
export interface WidgetDef {
  id: string;
  label: string;
  defaultLayout: { x: number; y: number; w: number; h: number; minW?: number; minH?: number };
}

export const WIDGET_DEFS: WidgetDef[] = [
  { id: "reviewAlerts",  label: "검수 피드백",       defaultLayout: { x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 } },
  { id: "radialGoal",    label: "목표 달성률",       defaultLayout: { x: 0, y: 3, w: 4,  h: 5, minW: 3, minH: 4 } },
  { id: "heroPerf",      label: "핵심 성과",         defaultLayout: { x: 4, y: 3, w: 8,  h: 5, minW: 4, minH: 4 } },
  { id: "channelAct",    label: "채널별 개통",       defaultLayout: { x: 0, y: 8, w: 12, h: 4, minW: 6, minH: 3 } },
  { id: "activation",    label: "개통 분석",         defaultLayout: { x: 0, y: 12, w: 12, h: 4, minW: 6, minH: 3 } },
  { id: "statCards",     label: "핵심 지표",         defaultLayout: { x: 0, y: 16, w: 12, h: 3, minW: 6, minH: 2 } },
  { id: "perfChart",     label: "실적 차트",         defaultLayout: { x: 0, y: 19, w: 8,  h: 5, minW: 4, minH: 4 } },
  { id: "channelDonut",  label: "채널 도넛",         defaultLayout: { x: 8, y: 19, w: 4,  h: 5, minW: 3, minH: 4 } },
  { id: "storeRevenue",  label: "매장 매출 순위",    defaultLayout: { x: 0, y: 24, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "storeEfficiency",label: "매장 효율",        defaultLayout: { x: 6, y: 24, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "perfLedger",    label: "실적 원장",         defaultLayout: { x: 0, y: 29, w: 12, h: 5, minW: 6, minH: 3 } },
  { id: "overallModel",  label: "전체 모델 분석",    defaultLayout: { x: 0, y: 34, w: 12, h: 5, minW: 6, minH: 3 } },
  { id: "channelModel",  label: "채널 모델 분석",    defaultLayout: { x: 0, y: 39, w: 12, h: 5, minW: 6, minH: 3 } },
  { id: "liveFeed",      label: "실시간 활동",       defaultLayout: { x: 0, y: 44, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "plannerFeed",   label: "기획팀 피드",       defaultLayout: { x: 6, y: 44, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "inventory",     label: "재고 현황",         defaultLayout: { x: 0, y: 49, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "strategyGauges",label: "전략 모델 게이지",  defaultLayout: { x: 6, y: 49, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "adSchedule",    label: "광고 일정",         defaultLayout: { x: 0, y: 54, w: 6,  h: 5, minW: 4, minH: 4 } },
  { id: "ranking",       label: "랭킹",             defaultLayout: { x: 6, y: 54, w: 6,  h: 5, minW: 4, minH: 4 } },
];

const STORAGE_KEY = "dashboard_layout_v2";
const HIDDEN_KEY = "dashboard_hidden_v2";

function buildDefaultLayout(): LayoutItem[] {
  return WIDGET_DEFS.map((w) => ({
    i: w.id,
    ...w.defaultLayout,
  }));
}

export function useDashboardLayout() {
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return buildDefaultLayout();
  });

  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(HIDDEN_KEY);
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  const [editing, setEditing] = useState(false);

  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
  }, []);

  const saveLayout = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hiddenIds]));
    setEditing(false);
  }, [layout, hiddenIds]);

  const resetLayout = useCallback(() => {
    const def = buildDefaultLayout();
    setLayout(def);
    setHiddenIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HIDDEN_KEY);
    setEditing(false);
  }, []);

  const hideWidget = useCallback((id: string) => {
    setHiddenIds((prev) => new Set([...prev, id]));
  }, []);

  const showWidget = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  }, []);

  const visibleLayout = layout.filter((l: LayoutItem) => !hiddenIds.has(l.i));

  return {
    layout: visibleLayout,
    fullLayout: layout,
    hiddenIds,
    editing,
    setEditing,
    onLayoutChange,
    saveLayout,
    resetLayout,
    hideWidget,
    showWidget,
  };
}