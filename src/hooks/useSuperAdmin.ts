import { useAuth } from "@/contexts/AuthContext";

export const SUPER_ADMIN_EMAIL = "h860306@naver.com";

/**
 * 슈퍼관리자(h860306@naver.com) 전용 권한 체크 훅
 * 계정 삭제(소프트 삭제) 등 최고 권한이 필요한 동작에 사용
 */
export function useSuperAdmin(): { isSuperAdmin: boolean; email: string | null } {
  const { user } = useAuth();
  const email = user?.email ?? null;
  const isSuperAdmin = (email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
  return { isSuperAdmin, email };
}