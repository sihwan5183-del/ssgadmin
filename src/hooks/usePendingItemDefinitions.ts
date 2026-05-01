import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingItemDefinition {
  id: string;
  label: string;
  sort_order: number;
  active: boolean;
  required: boolean;
}

/**
 * 관리자가 [미처리 항목 설정] 메뉴에서 관리하는 체크리스트.
 *
 * - `items`     : 활성(active=true) 항목만 정렬 순서대로 (입력창/검수창에 표시)
 * - `allItems`  : 비활성 포함 전체 (어드민 화면 전용)
 * - `requiredLabels` : 필수 체크 항목의 label 집합 — 다음 단계 진행 가능 여부 판단용
 *
 * 변경사항은 Supabase realtime 으로 즉시 반영됩니다.
 */
export const usePendingItemDefinitions = () => {
  const [allItems, setAllItems] = useState<PendingItemDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pending_item_definitions")
      .select("id, label, sort_order, active, required")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    setAllItems((data ?? []) as PendingItemDefinition[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // realtime 구독: subscribe() 이전에 모든 listener 등록 — 이전 패턴 회피
    const channel = supabase
      .channel("realtime:pending-item-definitions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pending_item_definitions" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const items = allItems.filter((d) => d.active);
  const requiredLabels = items.filter((d) => d.required).map((d) => d.label);

  return { items, allItems, requiredLabels, loading, refresh };
};