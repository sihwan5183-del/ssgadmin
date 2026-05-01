import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * 전체 직원의 user_id → display_name 매핑.
 *
 * `sales.manager` 등 일부 컬럼에 사용자의 user_id(UUID) 가 그대로 저장되어
 * UI 에 노출되는 문제를 방지하기 위한 공용 리졸버 입니다. 삭제된 직원
 * (status='deleted' / deleted_at 존재) 은 이름 뒤에 '(퇴사자)' 를 붙입니다.
 */
export function useStaffNames() {
  const [map, setMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, status, deleted_at")
        .limit(2000);
      if (!alive) return;
      const m: Record<string, string> = {};
      (data ?? []).forEach((p: any) => {
        if (!p.user_id) return;
        const isResigned = p.status === "deleted" || p.status === "resigned" || !!p.deleted_at;
        m[p.user_id] = isResigned ? `${p.display_name}(퇴사자)` : p.display_name;
      });
      setMap(m);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  /**
   * UUID 또는 이미 이름인 값을 받아서 표시용 이름을 돌려줍니다.
   * 매핑에 없거나 빈 값이면 fallback 을 반환합니다.
   */
  const resolve = (value: string | null | undefined, fallback = "-"): string => {
    if (!value) return fallback;
    // 표준 UUID v4 형식만 매핑 시도, 그 외는 이미 이름이라고 가정
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (!isUuid) return value;
    return map[value] ?? fallback;
  };

  return { map, resolve, loading };
}