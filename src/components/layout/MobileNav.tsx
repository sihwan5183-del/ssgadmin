import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const leftItems = [
  { to: "/", label: "대시보드", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { to: "/leads", label: "잠재고객", icon: Users, match: (p: string) => p.startsWith("/leads") },
];

const rightItems = [
  { to: "/sales-ledger", label: "판매장표", icon: BarChart3, match: (p: string) => p.startsWith("/sales-ledger") },
];

export const MobileNav = () => {
  const { pathname } = useLocation();
  const inputActive = pathname === "/input";
  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-border/40 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]"
      aria-label="하단 네비게이션"
    >
      <div className="relative grid grid-cols-5 items-end">
        {/* 좌측 2개: 대시보드 / 잠재고객 */}
        {leftItems.map((it) => (
          <NavItem key={it.to} item={it} active={it.match(pathname)} />
        ))}

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
            <span className="text-[10px] font-bold leading-none">실적입력</span>
          </NavLink>
        </div>

        {/* 우측: 판매장표 + 마이페이지 자리 */}
        {rightItems.map((it) => (
          <NavItem key={it.to} item={it} active={it.match(pathname)} />
        ))}
        <NavItem
          item={{ to: "/my", label: "마이", icon: require("lucide-react").User }}
          active={pathname.startsWith("/my")}
        />
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
        active ? "text-primary" : "text-slate-500 dark:text-muted-foreground"
      )}
    >
      <Icon className={cn("size-[22px]", active && "drop-shadow-[0_0_8px_hsl(330_100%_55%/0.6)]")} />
      <span className="text-[11px] font-semibold leading-none">{item.label}</span>
    </NavLink>
  );
}
