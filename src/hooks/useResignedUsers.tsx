import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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