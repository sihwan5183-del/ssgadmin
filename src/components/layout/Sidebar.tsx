import { NavLink, useLocation } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { ChevronDown, LogOut, Sparkles, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { useMenuConfig, type MenuRole } from "@/hooks/useMenuConfig";
import { resolveIcon } from "@/lib/menuIcons";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Sidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin, isManager, loading: roleLoading } = useRole();
  const { groups, items, loading } = useMenuConfig();

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
              (!i.is_admin_only || isAdmin)
          )
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, items, currentRole, isAdmin]);

  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [newLeadCount, setNewLeadCount] = useState(0);

  // 비밀번호 변경 모달
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const computeSinceIso = () => {
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(20, 0, 0, 0);
      if (cutoff > now) cutoff.setDate(cutoff.getDate() - 1);
      return new Date(cutoff.getTime() - 24 * 60 * 60 * 1000).toISOString();
    };
    const fetchCount = async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "신규 접수")
        .gte("created_at", computeSinceIso());
      if (!cancelled) setNewLeadCount(count ?? 0);
    };
    fetchCount();
    const tick = setInterval(fetchCount, 60 * 1000);
    const ch = supabase
      .channel("sidebar-leads-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fetchCount)
      .subscribe();
    return () => {
      cancelled = true;
      clearInterval(tick);
      supabase.removeChannel(ch);
    };
  }, []);

  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.items.some((i) => i.path === location.pathname)
    );
    if (activeGroup && openIds[activeGroup.id] === undefined) {
      setOpenIds((p) => ({ ...p, [activeGroup.id]: true }));
    }
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

  const handleChangePassword = async () => {
    if (!newPw || !confirmPw) return toast.error("새 비밀번호를 입력해주세요");
    if (newPw !== confirmPw) return toast.error("새 비밀번호가 일치하지 않습니다");
    if (newPw.length < 6) return toast.error("비밀번호는 6자 이상이어야 합니다");
    setPwLoading(true);
    // 현재 비밀번호 확인 (재로그인)
    const email = user?.email ?? "";
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
    if (signInError) {
      setPwLoading(false);
      return toast.error("현재 비밀번호가 올바르지 않습니다");
    }
    // 비밀번호 변경
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) return toast.error("변경 실패: " + error.message);
    toast.success("비밀번호가 변경되었습니다");
    setPwModalOpen(false);
    setCurrentPw(""); setNewPw(""); setConfirmPw("");
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
                  hasActive ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <GroupIcon className="size-3.5" />
                <span className="flex-1 text-left">{g.name}</span>
                <ChevronDown className={cn("size-3.5 transition-transform", !isOpen && "-rotate-90")} />
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
      </nav>

      <div className="m-3 p-4 rounded-2xl glass border border-border/40">
        <div className="text-xs text-muted-foreground">로그인 계정</div>
        <div className="mt-1 font-semibold text-sm truncate">{user?.email ?? "-"}</div>
        <button
          onClick={() => setPwModalOpen(true)}
          className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg border border-border/40 hover:border-primary/40 transition-colors"
        >
          <KeyRound className="size-3.5" /> 비밀번호 변경
        </button>
        <button
          onClick={handleSignOut}
          className="mt-2 w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg border border-border/40 hover:border-primary/40 transition-colors"
        >
          <LogOut className="size-3.5" /> 로그아웃
        </button>
      </div>

      {/* 비밀번호 변경 모달 */}
      {pwModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPwModalOpen(false)}>
          <div className="bg-background rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="font-bold text-base mb-4">비밀번호 변경</div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">현재 비밀번호</label>
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background"
                  placeholder="현재 비밀번호"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">새 비밀번호</label>
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background"
                  placeholder="새 비밀번호 (6자 이상)"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">새 비밀번호 확인</label>
                <input
                  type="password"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background"
                  placeholder="새 비밀번호 재입력"
                  onKeyDown={e => e.key === "Enter" && handleChangePassword()}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => { setPwModalOpen(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
                className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm text-muted-foreground"
              >취소</button>
              <button
                onClick={handleChangePassword}
                disabled={pwLoading}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >{pwLoading ? "변경 중..." : "변경"}</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
