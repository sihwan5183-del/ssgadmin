import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const sideItems = [
  { to: "/", label: "홈", icon: LayoutDashboard },
  { to: "/my", label: "마이페이지", icon: User },
];

export const MobileNav = () => {
  const { pathname } = useLocation();
  const inputActive = pathname === "/input";
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/40 pb-[env(safe-area-inset-bottom)]"
      aria-label="하단 네비게이션"
    >
      <div className="relative grid grid-cols-3 items-end">
        {/* 왼쪽: 홈 */}
        <NavItem item={sideItems[0]} active={pathname === sideItems[0].to} />

        {/* 중앙: 강조된 실적 입력 버튼 */}
        <div className="flex justify-center">
          <NavLink
            to="/input"
            aria-label="실적 입력"
            className={cn(
              "relative -translate-y-3 flex flex-col items-center justify-center gap-0.5",
              "size-16 rounded-full text-primary-foreground",
              "bg-gradient-primary shadow-[0_8px_24px_-6px_hsl(330_100%_55%/0.55)]",
              "ring-4 ring-background active:scale-95 transition-transform",
              inputActive && "ring-primary/40"
            )}
          >
            <PlusCircle className="size-7" strokeWidth={2.4} />
            <span className="text-[10px] font-bold leading-none">실적</span>
          </NavLink>
        </div>

        {/* 오른쪽: 마이페이지 */}
        <NavItem item={sideItems[1]} active={pathname === sideItems[1].to} />
      </div>
    </nav>
  );
};

function NavItem({
  item,
  active,
}: {
  item: { to: string; label: string; icon: typeof LayoutDashboard };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={cn(
        "flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 text-[12px] transition-colors active:bg-primary/5",
        active ? "text-primary-glow" : "text-muted-foreground"
      )}
    >
      <Icon className={cn("size-6", active && "drop-shadow-[0_0_8px_hsl(330_100%_55%/0.7)]")} />
      <span className="text-[11px] font-semibold leading-none">{item.label}</span>
    </NavLink>
  );
}
