import { ReactNode, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

/**
 * 관리자(admin / ceo / planner) 만 접근 가능한 라우트 가드.
 * 그 외 계정은 토스트 안내 후 메인 대시보드로 강제 이동.
 */
export const AdminOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { isAdmin, loading } = useRole();
  const warned = useRef(false);

  useEffect(() => {
    if (!loading && !isAdmin && !warned.current) {
      warned.current = true;
      toast.error("접근 권한이 없습니다");
    }
  }, [loading, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center text-sm text-muted-foreground">
        권한 확인 중…
      </div>
    );
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};