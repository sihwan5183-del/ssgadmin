import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useRole, type AppRole } from "@/hooks/useRole";

export type AccessLevel = "none" | "read" | "write";
export type DataScope = "self" | "store" | "all";

export interface PositionPermissionRow {
  position_id: string;
  permission_key: string;
  access_level: AccessLevel;
}

export interface PositionRow {
  id: string;
  name: string;
  base_role: AppRole;
  data_scope: DataScope;
  active: boolean;
  sort_order: number;
}

/** 모든 직급 + 전체 권한 매트릭스 (관리자 화면용) */
export function usePositionPermissionsAll() {
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [matrix, setMatrix] = useState<Record<string, AccessLevel>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ data: pos }, { data: perms }] = await Promise.all([
      supabase.from("positions").select("*").order("sort_order"),
      supabase.from("position_permissions").select("position_id, permission_key, access_level"),
    ]);
    setPositions((pos ?? []) as PositionRow[]);
    const m: Record<string, AccessLevel> = {};
    for (const r of (perms ?? []) as PositionPermissionRow[]) {
      m[`${r.position_id}::${r.permission_key}`] = r.access_level;
    }
    setMatrix(m);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`pos-perm-all-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "position_permissions" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => refresh());
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { positions, matrix, loading, refresh };
}

/** 현재 로그인 사용자의 직급 + 권한 해석 */
export function useMyPermissions() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [position, setPosition] = useState<PositionRow | null>(null);
  const [perms, setPerms] = useState<Record<string, AccessLevel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setPosition(null); setPerms({}); setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("profiles").select("position").eq("user_id", user.id).maybeSingle();
      const positionName = (profile as { position?: string } | null)?.position ?? null;
      if (!positionName) {
        if (!cancelled) { setPosition(null); setPerms({}); setLoading(false); }
        return;
      }
      const { data: pos } = await supabase
        .from("positions").select("*").eq("name", positionName).eq("active", true).maybeSingle();
      if (!pos) {
        if (!cancelled) { setPosition(null); setPerms({}); setLoading(false); }
        return;
      }
      const { data: rows } = await supabase
        .from("position_permissions")
        .select("permission_key, access_level")
        .eq("position_id", (pos as PositionRow).id);
      const m: Record<string, AccessLevel> = {};
      for (const r of (rows ?? []) as { permission_key: string; access_level: AccessLevel }[]) {
        m[r.permission_key] = r.access_level;
      }
      if (!cancelled) {
        setPosition(pos as PositionRow);
        setPerms(m);
        setLoading(false);
      }
    };
    load();

    const ch = supabase
      .channel(`my-perms-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "position_permissions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => load());
    ch.subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  const can = useMemo(() => {
    return (key: string, need: AccessLevel = "read"): boolean => {
      if (isAdmin) return true; // admin/ceo 는 항상 허용
      const lvl = perms[key] ?? "none";
      if (need === "read") return lvl === "read" || lvl === "write";
      if (need === "write") return lvl === "write";
      return true;
    };
  }, [perms, isAdmin]);

  return { position, perms, can, dataScope: position?.data_scope ?? "self", loading };
}
