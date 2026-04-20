import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 비활성 직원이면 즉시 로그아웃
  const enforceActive = async (s: Session | null) => {
    if (!s?.user) return;
    const { data } = await supabase
      .from("profiles")
      .select("status")
      .eq("user_id", s.user.id)
      .maybeSingle();
    if (data && data.status !== "active") {
      toast.error(
        data.status === "leave"
          ? "휴직 상태입니다. 관리자에게 문의하세요."
          : "비활성화된 계정입니다. 관리자에게 문의하세요."
      );
      await supabase.auth.signOut();
    }
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setLoading(false);
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // 다음 tick에서 실행 (deadlock 방지)
        setTimeout(() => enforceActive(s), 0);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      setTimeout(() => enforceActive(data.session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
