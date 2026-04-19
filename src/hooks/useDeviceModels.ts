import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeviceModel {
  id: string;
  manufacturer: string;
  model_name: string;        // 펫네임 (예: S26)
  official_name: string | null; // 공식명 (예: SM-S942N)
  aliases: string[];          // 유사 키워드
  retail_price: number;
  active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, "");

export const useDeviceModels = (activeOnly = true) => {
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("device_models").select("*").order("sort_order").order("model_name");
    if (activeOnly) q = q.eq("active", true);
    const { data } = await q;
    setModels((data ?? []) as any as DeviceModel[]);
    setLoading(false);
  }, [activeOnly]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("device-models-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_models" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  /** 입력값 → 매칭된 모델 (없으면 null). 클라이언트 측 정규화 — DB 함수와 동일 우선순위 */
  const matchModel = useCallback(
    (raw: string): DeviceModel | null => {
      if (!raw) return null;
      const v = raw.toLowerCase().trim();
      const vn = norm(v);
      const active = models.filter((m) => m.active);
      // 1) 정확한 펫네임
      let hit = active.find((m) => m.model_name.toLowerCase() === v);
      if (hit) return hit;
      // 2) 정확한 공식명
      hit = active.find((m) => m.official_name?.toLowerCase() === v);
      if (hit) return hit;
      // 3) 유사어 정확매치
      hit = active.find((m) =>
        (m.aliases ?? []).some((a) => a.toLowerCase() === v || norm(a) === vn),
      );
      if (hit) return hit;
      // 4) 부분일치 (가장 긴 펫네임 우선)
      const partials = active.filter((m) => {
        const name = m.model_name.toLowerCase();
        const off = m.official_name?.toLowerCase() ?? "";
        return (
          v.includes(name) ||
          name.includes(v) ||
          (off && (v.includes(off) || off.includes(v))) ||
          (m.aliases ?? []).some(
            (a) => v.includes(a.toLowerCase()) || a.toLowerCase().includes(v),
          )
        );
      });
      partials.sort((a, b) => b.model_name.length - a.model_name.length);
      return partials[0] ?? null;
    },
    [models],
  );

  /** 자동완성 검색 (펫네임/공식명/유사어 부분일치) */
  const searchModels = useCallback(
    (query: string, limit = 8): DeviceModel[] => {
      const q = query.toLowerCase().trim();
      if (!q) return models.slice(0, limit);
      const qn = norm(q);
      const scored = models
        .map((m) => {
          const name = m.model_name.toLowerCase();
          const off = m.official_name?.toLowerCase() ?? "";
          const aliasHit = (m.aliases ?? []).some(
            (a) => a.toLowerCase().includes(q) || norm(a).includes(qn),
          );
          let score = 0;
          if (name === q) score = 100;
          else if (off === q) score = 95;
          else if (name.startsWith(q)) score = 80;
          else if (off.startsWith(q)) score = 75;
          else if (name.includes(q)) score = 60;
          else if (off.includes(q)) score = 55;
          else if (aliasHit) score = 50;
          return { m, score };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((x) => x.m);
    },
    [models],
  );

  return useMemo(
    () => ({ models, loading, reload: load, matchModel, searchModels }),
    [models, loading, load, matchModel, searchModels],
  );
};
