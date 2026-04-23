import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { session, loading, profileStatus } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground text-sm">
        불러오는 중…
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  if (profileStatus === "pending") {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto size-16 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="size-8 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold">승인 대기 중</h1>
          <p className="text-sm text-muted-foreground">
            관리자의 승인을 기다리고 있습니다.<br />
            승인이 완료되면 시스템을 이용하실 수 있습니다.
          </p>
          <button onClick={() => window.location.reload()} className="text-xs text-primary underline">새로고침</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
