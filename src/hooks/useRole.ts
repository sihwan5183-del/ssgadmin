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

/**
 * 시스템 5단계 권한 체계 표시 라벨
 * 1. 슈퍼관리자 (super_admin: 박태진 / h860306@naver.com)
 * 2. 관리자 (admin)
 * 3. 대표 (ceo)
 * 4. 팀장 (team_lead)
 * 5. 사원 (staff / user)
 * 기획팀(planner)·매니저(manager)는 내부 호환용으로 유지하되 라벨은 [관리자]로 출력
 */
export const DISPLAY_ROLE_LABELS: Record<AppRole, string> = {
  admin: "관리자",
  ceo: "대표",
  team_lead: "팀장",
  staff: "사원",
  user: "사원",
  planner: "관리자",
  manager: "관리자",
};

export function formatRoleLabel(role: AppRole | string | undefined, isSuperAdmin = false): string {
  if (isSuperAdmin) return "슈퍼관리자";
  if (!role) return "사원";
  return DISPLAY_ROLE_LABELS[role as AppRole] ?? "사원";
}

/** 권한 부여 드롭다운에 사용할 5가지 명칭 (super_admin은 시스템 자동 부여이므로 제외) */
export const ASSIGNABLE_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "admin",     label: "관리자", description: "시스템 운영 및 전매장 관리" },
  { value: "ceo",       label: "대표",   description: "전매장 실적 및 지출 현황 조회" },
  { value: "team_lead", label: "팀장",   description: "소속 팀 데이터 관리" },
  { value: "staff",     label: "사원",   description: "본인 실적/데이터만 관리" },
];

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
      .channel(`user-roles-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => load(),
      );
    ch.subscribe();
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
