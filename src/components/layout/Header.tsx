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
    <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          실시간 동기화 중
        </div>
        <h1 className="mt-0.5 text-xl md:text-2xl font-bold tracking-tight leading-tight" title={subtitle}>
          <span className="text-gradient">{title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {showPeriodFilter && <PeriodFilter />}
        {showScopeToggle && <ScopeToggle />}
        {rightSlot}
        <NotificationBell />
        <div className="size-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-semibold text-primary-foreground shadow-glow">
          기획
        </div>
      </div>
    </header>
  );
};
