import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, PlusCircle, Megaphone, Wallet, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "홈", icon: LayoutDashboard },
  { to: "/input", label: "실적", icon: PlusCircle },
  { to: "/expense-input", label: "지출입력", icon: Megaphone },
  { to: "/expenses", label: "지출", icon: Wallet },
  { to: "/field-options", label: "항목", icon: Settings2 },
];

export const MobileNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center gap-1 py-3 text-[11px] transition-colors",
                active ? "text-primary-glow" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_hsl(280_100%_70%/0.8)]")} />
              <span className="font-medium">{it.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
