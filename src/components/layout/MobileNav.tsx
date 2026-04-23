import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "홈", icon: LayoutDashboard },
  { to: "/input", label: "실적 입력", icon: PlusCircle },
  { to: "/my", label: "마이페이지", icon: User },
];

export const MobileNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 min-h-[60px] py-2 text-[12px] transition-colors active:bg-primary/5",
                active ? "text-primary-glow" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-6", active && "drop-shadow-[0_0_8px_hsl(330_100%_55%/0.7)]")} />
              <span className="font-semibold leading-none">{it.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
