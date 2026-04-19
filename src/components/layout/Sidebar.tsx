import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PlusCircle,
  Activity,
  Wallet,
  Megaphone,
  Trophy,
  Users,
  Sparkles,
  Settings2,
  ShieldCheck,
  LogOut,
  HeartHandshake,
  Link2,
  Smartphone,
  CalendarRange,
  Store as StoreIcon,
  FileWarning,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

const navItems = [
  { to: "/", label: "대시보드", icon: LayoutDashboard },
  { to: "/input", label: "실적 입력", icon: PlusCircle },
  { to: "/regulars", label: "단골 관리", icon: HeartHandshake },
  { to: "/activities", label: "활동 관리", icon: Activity },
  { to: "/missing-docs", label: "서류 미첨부", icon: FileWarning },
  { to: "/expenses", label: "지출 / ROI", icon: Wallet },
  { to: "/expense-input", label: "지출 비용 입력", icon: Megaphone },
  { to: "/ad-calendar", label: "광고 캘린더", icon: CalendarRange },
  { to: "/ranking", label: "랭킹", icon: Trophy },
  { to: "/device-inventory", label: "단말기 재고", icon: Smartphone },
  { to: "/field-options", label: "입력 항목 관리", icon: Settings2 },
  { to: "/team", label: "권한 / 뷰", icon: Users },
];

const adminItems = [
  { to: "/stores", label: "매장 관리", icon: StoreIcon },
  { to: "/product-rate-plans", label: "상품-요금제 매핑", icon: Link2 },
  { to: "/admin", label: "시스템 설정", icon: ShieldCheck },
];

export const Sidebar = () => {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { isAdmin } = useRole();
  const handleSignOut = async () => {
    await signOut();
    toast.success("로그아웃 되었습니다");
  };
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
        {[...navItems, ...(isAdmin ? adminItems : [])].map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          const isAdminLink = adminItems.some((a) => a.to === item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground ring-gradient relative"
                  : "text-sidebar-foreground/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60",
                isAdminLink && "mt-3 border-t border-border/40 pt-4 rounded-xl"
              )}
            >
              <Icon className={cn("size-4", active && "text-primary-glow")} />
              <span className="font-medium">{item.label}</span>
              {isAdminLink && (
                <span className="ml-auto text-[9px] text-primary uppercase tracking-wider font-semibold">admin</span>
              )}
            </NavLink>
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
