import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { ChevronDown, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useMenuConfig, type MenuRole } from "@/hooks/useMenuConfig";
import { resolveIcon } from "@/lib/menuIcons";
import { toast } from "sonner";

export const Sidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { groups, items, loading } = useMenuConfig();

  const currentRole: MenuRole = isAdmin ? "admin" : isManager ? "manager" : "user";

  // 사원에게는 노출하지 않을 경로 (팀장 이상 전용)
  // - 매출 정산, 업체 관리(SEG), 관리자 설정, 직원/계정 관리, 인센티브/제품 마스터, 다운로드
  // 지출 비용 관리(/ad-spend, /expense-input)는 모든 직원 접근 허용 (본인 작성 건만 수정 가능)
  const STAFF_BLOCKED_PREFIXES = [
    "/seg", "/admin", "/account",
    "/menu-manager", "/incentive", "/product-rate", "/equipment",
    "/budget", "/device-models", "/field-options", "/downloads", "/expenses",
    "/staff-status", "/team",
  ];

  const visibleGroups = useMemo(() => {
    return groups
      .filter((g) => g.active && g.visible_roles.includes(currentRole))
      .map((g) => ({
        ...g,
        items: items
          .filter(
            (i) =>
              i.active &&
              i.group_id === g.id &&
              i.visible_roles.includes(currentRole) &&
              (!i.is_admin_only || isAdmin) &&
              // 사원이면 위 prefix 경로 차단
              (currentRole !== "user" || !STAFF_BLOCKED_PREFIXES.some((p) => i.path.startsWith(p)))
          )
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, items, currentRole, isAdmin]);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  // Auto-open the group containing the active route
  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.items.some((i) => i.path === location.pathname)
    );
    if (activeGroup && openIds[activeGroup.id] === undefined) {
      setOpenIds((p) => ({ ...p, [activeGroup.id]: true }));
    }
    // Default: open all on first load
    if (Object.keys(openIds).length === 0 && visibleGroups.length > 0) {
      const init: Record<string, boolean> = {};
      visibleGroups.forEach((g) => (init[g.id] = true));
      setOpenIds(init);
    }
  }, [visibleGroups, location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setOpenIds((p) => ({ ...p, [id]: !p[id] }));

  const handleSignOut = async () => {
    await signOut();
    toast.success("로그아웃 되었습니다");
  };

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[13.5rem] flex-col glass-strong border-r border-border/40 z-40">
      <div className="px-4 py-4 flex items-center gap-2.5">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
         <div>
           <div className="text-sm text-muted-foreground leading-none">U+다이렉트</div>
           <div className="text-base font-semibold tracking-tight mt-1">영업기획팀</div>
         </div>
      </div>

      <nav className="px-3 py-2 flex-1 overflow-y-auto space-y-1">
        {(loading || roleLoading) && (
          <div className="px-3 py-4 text-xs text-muted-foreground">메뉴 불러오는 중…</div>
        )}
        {!loading && visibleGroups.map((g) => {
          const GroupIcon = resolveIcon(g.icon);
          const isOpen = openIds[g.id] ?? true;
          const hasActive = g.items.some((i) => i.path === location.pathname);
          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => toggle(g.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] uppercase tracking-wider font-semibold transition-colors",
                  hasActive
                    ? "text-primary-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GroupIcon className="size-3.5" />
                <span className="flex-1 text-left">{g.name}</span>
                <ChevronDown
                  className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")}
                />
              </button>
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {g.items.map((item) => {
                    const Icon = resolveIcon(item.icon);
                    const active = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 ml-2 rounded-xl text-sm transition-all duration-300",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground ring-gradient relative"
                            : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60"
                        )}
                      >
                        <Icon className={cn("size-4", active && "text-primary-glow")} />
                        <span className="font-medium">{item.label}</span>
                        {item.is_admin_only && (
                          <span className="ml-auto text-[9px] text-primary uppercase tracking-wider font-semibold">
                            관리자
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="m-3 p-4 rounded-2xl glass border border-border/40">
        <div className="text-xs text-muted-foreground">로그인 계정</div>
        <div className="mt-1 font-semibold text-sm truncate">{user?.email ?? "-"}</div>
        <button
          onClick={handleSignOut}
          className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg border border-border/40 hover:border-primary/40 transition-colors"
        >
          <LogOut className="size-3.5" /> 로그아웃
        </button>
      </div>
    </aside>
  );
};
