import { useAuth } from "@/contexts/AuthContext";
import { useRole, formatRoleLabel } from "@/hooks/useRole";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, User, Shield, Store } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

const MyPage = () => {
  const { user } = useAuth();
  const { primaryRole, isAdmin, roles } = useRole();
  const { isSuperAdmin } = useSuperAdmin();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      <Header title="마이페이지" subtitle="내 정보 및 계정 관리" showScopeToggle={false} />
      <div className="max-w-md mx-auto space-y-4 py-4">
        <section className="glass rounded-2xl p-5 shadow-card-elevated space-y-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-gradient-primary grid place-items-center shadow-glow">
              <User className="size-6 text-primary-foreground" />
            </div>
            <div>
              <p className="font-semibold text-sm">{profile?.display_name ?? "사용자"}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-muted-foreground flex items-center gap-2"><Shield className="size-3.5" /> 권한</span>
              <Badge variant="outline">
                {formatRoleLabel(
                  isSuperAdmin ? undefined : (roles.includes("ceo") ? "ceo" : roles.includes("admin") ? "admin" : roles.includes("team_lead") ? "team_lead" : primaryRole),
                  isSuperAdmin
                )}
              </Badge>
            </div>
            {profile?.store && (
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-2"><Store className="size-3.5" /> 매장</span>
                <span>{profile.store}</span>
              </div>
            )}
            {profile?.team && (
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground flex items-center gap-2">팀</span>
                <span>{profile.team}</span>
              </div>
            )}
            {profile?.position && (
              <div className="flex items-center justify-between py-2 border-b border-border/30">
                <span className="text-muted-foreground">직급</span>
                <span>{profile.position}</span>
              </div>
            )}
          </div>
        </section>

        <Button variant="outline" className="w-full rounded-2xl h-12 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleLogout}>
          <LogOut className="size-4 mr-2" /> 로그아웃
        </Button>
      </div>
    </>
  );
};

export default MyPage;