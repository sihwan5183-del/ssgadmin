import { ScopeToggle } from "./ScopeToggle";
import { PeriodFilter } from "./PeriodFilter";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showScopeToggle?: boolean;
  showPeriodFilter?: boolean;
  rightSlot?: React.ReactNode;
}

export const Header = ({
  title,
  subtitle,
  showScopeToggle = true,
  showPeriodFilter = true,
  rightSlot,
}: HeaderProps) => {
  return (
    <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-2 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          실시간 동기화 중
        </div>
        <h1 className="mt-0.5 text-lg md:text-2xl font-bold tracking-tight leading-tight" title={subtitle}>
          <span className="text-gradient">{title}</span>
        </h1>
        {subtitle && (
          <p className="hidden md:block text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <GlobalSearch className="w-52 hidden md:block" />
        {showPeriodFilter && <PeriodFilter />}
        {showScopeToggle && <ScopeToggle />}
        {rightSlot}
        {/* 모바일에선 NotificationBell이 MobileTopBar에 이미 있으므로 숨김 */}
        <div className="hidden lg:block"><NotificationBell /></div>
        <div className="hidden lg:grid size-8 rounded-full bg-gradient-primary place-items-center text-xs font-semibold text-primary-foreground shadow-glow">
          기획
        </div>
      </div>
    </header>
  );
};
