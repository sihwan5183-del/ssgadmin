import { useEffect, useMemo, useState } from "react";
import { Outlet, NavLink as RRNav, useLocation, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Card } from "@/components/ui/card";
import { Users, UserCheck, Clock3, ShieldCheck, UserPlus, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

interface Stats { total: number; active: number; pending: number; suspended: number; }

const TABS = [
  { to: "/admin/accounts/pending", label: "가입 승인 대기", icon: UserPlus },
  { to: "/admin/accounts/staff", label: "전체 직원 관리", icon: Users },
  { to: "/admin/accounts/roles", label: "권한·매장 설정", icon: ShieldCheck },
];

export default function AccountManagementPage() {
  const { isAdmin, loading } = useRole();
  const loc = useLocation();
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, pending: 0, suspended: 0 });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("status");
      const rows = (data ?? []) as { status: string }[];
      setStats({
        total: rows.length,
        active: rows.filter((r) => r.status === "active").length,
        pending: rows.filter((r) => r.status === "pending").length,
        suspended: rows.filter((r) => r.status === "suspended" || r.status === "resigned" || r.status === "leave").length,
      });
    })();
  }, [loc.pathname]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">권한 확인 중…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  // 기본 경로면 가입 승인 대기로
  if (loc.pathname === "/admin/accounts") return <Navigate to="/admin/accounts/pending" replace />;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="size-11 rounded-2xl bg-gradient-primary grid place-items-center shadow-glow">
          <UserCog className="size-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">계정 관리</h1>
          <p className="text-xs text-muted-foreground">직원 승인 · 권한 · 매장/직급 마스터를 한 곳에서 관리합니다.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox icon={Users} label="전체 인원" value={stats.total} tone="primary" />
        <StatBox icon={UserCheck} label="활성 계정" value={stats.active} tone="success" />
        <StatBox icon={Clock3} label="승인 대기" value={stats.pending} tone="warning" />
        <StatBox icon={ShieldCheck} label="정지/퇴사/휴직" value={stats.suspended} tone="muted" />
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border/40">
        {TABS.map((t) => {
          const active = loc.pathname.startsWith(t.to);
          return (
            <RRNav
              key={t.to}
              to={t.to}
              className={cn(
                "px-4 py-2 -mb-px text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </RRNav>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}

function StatBox({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: string }) {
  const toneClass = {
    primary: "from-primary/15 to-primary/5 text-primary",
    success: "from-emerald-500/15 to-emerald-500/5 text-emerald-600",
    warning: "from-amber-500/15 to-amber-500/5 text-amber-600",
    muted: "from-muted to-muted/40 text-muted-foreground",
  }[tone] ?? "from-muted to-muted/40 text-muted-foreground";
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn("size-10 rounded-xl bg-gradient-to-br grid place-items-center", toneClass)}>
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}
