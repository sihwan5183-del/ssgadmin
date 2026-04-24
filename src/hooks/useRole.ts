import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole =
  | "admin"
  | "manager"
  | "user"
  | "ceo"
  | "planner"
  | "team_lead"
  | "staff";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "관리자",
  manager: "매니저",
  user: "사용자",
  ceo: "대표",
  planner: "기획팀",
  team_lead: "팀장",
  staff: "일반직원",
};

// 관리자 권한 = admin 또는 ceo 또는 planner
const ADMIN_ROLES: AppRole[] = ["admin", "ceo", "planner"];
// 매니저 권한 = 관리자 + team_lead + manager
const MANAGER_ROLES: AppRole[] = [...ADMIN_ROLES, "manager", "team_lead"];

export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const load = () => {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .then(({ data }) => {
          if (cancelled) return;
          setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
          setLoading(false);
        });
    };
    load();
    // 실시간 권한 변경 반영
    const ch = supabase
      .channel(`user-roles-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, [user]);

  return {
    roles,
    isAdmin: roles.some((r) => ADMIN_ROLES.includes(r)),
    isManager: roles.some((r) => MANAGER_ROLES.includes(r)),
    isStaff: roles.includes("staff") || roles.includes("user"),
    primaryRole: (roles[0] ?? "staff") as AppRole,
    loading,
  };
}
