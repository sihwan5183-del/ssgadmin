import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatStaffName } from "@/lib/staffName";

/**
 * 퇴사/삭제 처리된 user_id 집합을 반환.
 * 판매장표·검수 리스트에서 작성자 옆에 "(퇴사자)" 라벨을 붙일 때 사용.
 */
let cache: { ids: Set<string>; ts: number } | null = null;
const TTL_MS = 60 * 1000;

export function useResignedUsers() {
  const [ids, setIds] = useState<Set<string>>(() => cache?.ids ?? new Set());

  useEffect(() => {
    let cancelled = false;
    if (cache && Date.now() - cache.ts < TTL_MS) {
      setIds(cache.ids);
      return;
    }
    supabase
      .from("profiles")
      .select("user_id, status")
      .in("status", ["resigned", "deleted"])
      .then(({ data }) => {
        if (cancelled) return;
        const set = new Set<string>(((data ?? []) as { user_id: string }[]).map((r) => r.user_id));
        cache = { ids: set, ts: Date.now() };
        setIds(set);
      });
    return () => { cancelled = true; };
  }, []);

  return ids;
}

export function ResignedTag({ userId, ids }: { userId: string | null | undefined; ids: Set<string> }) {
  if (!userId || !ids.has(userId)) return null;
  return (
    <span className="ml-1 text-[10px] font-semibold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded align-middle">
      퇴사자
    </span>
  );
}

/**
 * userId -> { name, resigned, displayName('홍길동(퇴사자)') } 맵.
 * 통계 합산엔 영향이 없고, 표시 단계에서만 활용한다.
 */
export interface StaffNameInfo { name: string; resigned: boolean; displayName: string }

let nameCache: { map: Record<string, StaffNameInfo>; ts: number } | null = null;

export function useStaffNameMap() {
  const [map, setMap] = useState<Record<string, StaffNameInfo>>(
    () => nameCache?.map ?? {},
  );
  useEffect(() => {
    let cancelled = false;
    if (nameCache && Date.now() - nameCache.ts < TTL_MS) {
      setMap(nameCache.map);
      return;
    }
    supabase
      .from("profiles")
      .select("user_id, display_name, status")
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, StaffNameInfo> = {};
        for (const r of (data ?? []) as { user_id: string; display_name: string; status: string }[]) {
          const resigned = r.status === "resigned" || r.status === "deleted";
          next[r.user_id] = {
            name: r.display_name,
            resigned,
            displayName: formatStaffName(r.display_name, resigned),
          };
        }
        nameCache = { map: next, ts: Date.now() };
        setMap(next);
      });
    return () => { cancelled = true; };
  }, []);
  return map;
}