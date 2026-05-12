import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 실적/성과 통계 화면 전역 필터.
 *
 * 직원관리에서 [실적 대시보드 노출] 스위치가 ON 인 직원만 반환합니다.
 * 대시보드 / 판매실적장표 담당자 드롭다운 / 직원별 실적 현황 / 랭킹 등
 * "실적이 보여야 하는 곳" 에서 공통으로 사용합니다.
 *
 * 단, [직원 관리] 메뉴는 전체 직원이 보여야 하므로 이 훅을 쓰지 않습니다.
 */
export type DashboardStaff = {
  user_id: string;
  display_name: string;
  store: string | null;
  team: string | null;
  position: string | null;
};

export function useDashboardStaff() {
  const [staff, setStaff] = useState<DashboardStaff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, store, team, position, status, show_in_dashboard")
        .eq("show_in_dashboard", true)
        .neq("status", "deleted")
        .neq("status", "resigned")
        .order("display_name");
      if (!alive) return;
      setStaff((data ?? []) as DashboardStaff[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const idSet = new Set(staff.map((s) => s.user_id));
  const nameSet = new Set(
    staff.map((s) => (s.display_name ?? "").trim().toLowerCase()).filter(Boolean),
  );

  /** uid 또는 이름(대소문자/공백 무시) 이 노출 대상이면 true */
  const isDashboardStaff = (value: string | null | undefined): boolean => {
    if (!value) return false;
    const v = value.trim();
    if (!v) return false;
    if (idSet.has(v)) return true;
    return nameSet.has(v.toLowerCase());
  };

  return { staff, idSet, nameSet, isDashboardStaff, loading };
}