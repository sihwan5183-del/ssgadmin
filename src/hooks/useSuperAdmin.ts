import { useAuth } from "@/contexts/AuthContext";

export const SUPER_ADMIN_EMAIL = "kksin00@gmail.com";
export const SUPER_ADMIN_NAME = "김시환";

/**
 * 슈퍼관리자(kksin00@gmail.com) 전용 권한 체크 훅
 * 계정 삭제(소프트 삭제) 등 최고 권한이 필요한 동작에 사용
 */
export function useSuperAdmin(): { isSuperAdmin: boolean; email: string | null } {
  const { user, profileName } = useAuth();
  const email = user?.email ?? null;
  const metaName =
    typeof user?.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user?.user_metadata?.name === "string"
        ? user.user_metadata.name
        : null;
  const normalizedName = (profileName ?? metaName ?? "").trim();
  const isSuperAdmin =
    (email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL || normalizedName === SUPER_ADMIN_NAME;
  return { isSuperAdmin, email };
}
