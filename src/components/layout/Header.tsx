import { ScopeToggle } from "./ScopeToggle";
import { PeriodFilter } from "./PeriodFilter";
import { NotificationBell } from "./NotificationBell";

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
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          실시간 동기화 중
        </div>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
          <span className="text-gradient">{title}</span>
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {showPeriodFilter && <PeriodFilter />}
        {showScopeToggle && <ScopeToggle />}
        {rightSlot}
        <NotificationBell />
        <div className="size-10 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground shadow-glow">
          기획
        </div>
      </div>
    </header>
  );
};
