import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  Activity,
  Wallet,
  Trophy,
  Users,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "대시보드", icon: LayoutDashboard },
  { to: "/input", label: "실적 입력", icon: PlusCircle },
  { to: "/activities", label: "활동 관리", icon: Activity },
  { to: "/expenses", label: "지출 / ROI", icon: Wallet },
  { to: "/ranking", label: "랭킹", icon: Trophy },
  { to: "/team", label: "권한 / 뷰", icon: Users },
];

export const Sidebar = () => {
  const location = useLocation();
  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 flex-col glass-strong border-r border-border/40 z-40">
      <div className="px-6 py-7 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-gradient-primary grid place-items-center shadow-glow">
          <Sparkles className="size-5 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground leading-none">통신사</div>
          <div className="text-base font-semibold tracking-tight mt-1">영업기획팀</div>
        </div>
      </div>

      <nav className="px-3 py-4 flex-1 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300",
                active
                  ? "bg-gradient-soft text-foreground ring-gradient relative"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              <Icon className={cn("size-4", active && "text-primary-glow")} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="m-3 p-4 rounded-2xl glass border border-border/40">
        <div className="text-xs text-muted-foreground">로그인</div>
        <div className="mt-1 font-semibold text-sm">대표 / 기획팀</div>
        <div className="mt-3 text-[11px] text-muted-foreground">전체 분석 권한 활성</div>
      </div>
    </aside>
  );
};
