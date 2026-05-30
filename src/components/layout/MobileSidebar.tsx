import { useEffect, useMemo, useState } from "react";
import { ChevronDown, LogOut, Menu, Sparkles, X } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useMenuConfig, type MenuRole } from "@/hooks/useMenuConfig";
import { resolveIcon } from "@/lib/menuIcons";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * 모바일/태블릿(lg 미만) 전용 좌측 슬라이드 메뉴 드로어.
 * - 데스크톱 Sidebar 컴포넌트를 재사용하지 않고 독립적으로 메뉴 트리를 렌더해
 *   `hidden lg:flex` 충돌이나 z-index/배경 겹침으로 인한 흰 화면 버그를 원천 차단.
 */
export const MobileSidebar = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, isManager } = useRole();
  const { groups, items } = useMenuConfig();

  const currentRole: MenuRole = isAdmin ? "admin" : isManager ? "manager" : "user";

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
              (!i.is_admin_only || isAdmin),
          )
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, items, currentRole, isAdmin]);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (visibleGroups.length && Object.keys(openIds).length === 0) {
      const init: Record<string, boolean> = {};
      visibleGroups.forEach((g) => (init[g.id] = true));
      setOpenIds(init);
    }
  }, [visibleGroups, openIds]);

  // 라우트 이동 시 자동 닫기
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // body 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // 신규 리드 카운트
  const [newLeadCount, setNewLeadCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "신규 접수");
      if (!cancelled) setNewLeadCount(count ?? 0);
    };
    fetchCount();
    const ch = supabase
      .channel("mobile-sidebar-leads-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        fetchCount,
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  const toggle = (id: string) => setOpenIds((p) => ({ ...p, [id]: !p[id] }));

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    toast.success("로그아웃 되었습니다");
  };

  return (
    <>
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setOpen(true)}
        className="lg:hidden inline-flex items-center justify-center size-11 rounded-xl bg-white border border-slate-200 shadow-sm active:scale-95 transition-transform"
      >
        <Menu className="size-5 text-slate-900" />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-[9999]">
          {/* 오버레이 */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          {/* 드로어 */}
          <aside
            role="dialog"
            aria-label="메뉴"
            className="absolute left-0 top-0 w-[280px] max-w-[85vw] bg-white shadow-2xl flex flex-col"
            style={{ height: "100dvh" }}
          >
            <div className="px-4 py-4 flex items-center gap-2.5 border-b border-slate-100">
              <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
                <Sparkles className="size-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 leading-none">U+다이렉트</div>
                <div className="text-base font-semibold tracking-tight mt-1 text-slate-900">
                  영업기획팀
                </div>
              </div>
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setOpen(false)}
                className="size-9 grid place-items-center rounded-lg hover:bg-slate-100 text-slate-700"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {visibleGroups.map((g) => {
                const GroupIcon = resolveIcon(g.icon);
                const isOpenGroup = openIds[g.id] ?? true;
                return (
                  <div key={g.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggle(g.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-900"
                    >
                      <GroupIcon className="size-3.5" />
                      <span className="flex-1 text-left">{g.name}</span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform",
                          !isOpenGroup && "-rotate-90",
                        )}
                      />
                    </button>
                    {isOpenGroup && (
                      <div className="mt-0.5 space-y-0.5">
                        {g.items.map((item) => {
                          const Icon = resolveIcon(item.icon);
                          const active = location.pathname === item.path;
                          return (
                            <NavLink
                              key={item.id}
                              to={item.path}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2.5 ml-2 rounded-xl text-sm transition-colors",
                                active
                                  ? "bg-slate-100 text-slate-900 font-semibold"
                                  : "text-slate-800 hover:bg-slate-50",
                              )}
                            >
                              <Icon
                                className={cn(
                                  "size-4",
                                  active ? "text-primary" : "text-slate-600",
                                )}
                              />
                              <span>{item.label}</span>
                              {item.path === "/leads" && newLeadCount > 0 && (
                                <span className="ml-auto inline-flex min-w-[18px] h-[18px] px-1.5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
                                  {newLeadCount}
                                </span>
                              )}
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
              {visibleGroups.length === 0 && (
                <div className="px-3 py-6 text-sm text-slate-500">
                  메뉴 불러오는 중…
                </div>
              )}
            </nav>

            <div className="m-3 p-4 rounded-2xl border border-slate-100 bg-slate-50/60">
              <div className="text-xs text-slate-500">로그인 계정</div>
              <div className="mt-1 font-semibold text-sm truncate text-slate-900">
                {user?.email ?? "-"}
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-slate-700 hover:text-slate-900 py-2 rounded-lg border border-slate-200 hover:border-primary/40 transition-colors bg-white"
              >
                <LogOut className="size-3.5" /> 로그아웃
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
};
