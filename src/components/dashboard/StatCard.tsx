import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  delta?: number;
  icon: LucideIcon;
  accent?: "primary" | "secondary" | "success" | "warning";
  hint?: string;
  /** 카드 상단에 작게 표시되는 기준 시점 (예: "11월 누적", "11.28 (목) 당일") */
  periodLabel?: string;
}

const accentMap = {
  primary: "from-primary/30 to-primary-glow/10 text-primary-glow",
  secondary: "from-secondary/30 to-primary/10 text-secondary",
  success: "from-success/30 to-success/5 text-success",
  warning: "from-warning/30 to-warning/5 text-warning",
};

export const StatCard = ({ label, value, delta, icon: Icon, accent = "primary", hint, periodLabel }: StatCardProps) => {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className="group relative bg-card rounded-2xl p-4 md:p-5 overflow-hidden border border-border/60 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5"
      title={hint}
    >
      <div className={cn("absolute -top-12 -right-12 size-32 rounded-full bg-gradient-to-br blur-2xl opacity-40 group-hover:opacity-70 transition-opacity", accentMap[accent])} />
      <div className="relative">
        {periodLabel && (
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider truncate mb-1.5">
            {periodLabel}
          </div>
        )}
        <div className="flex items-center justify-between mb-2">
          <div className={cn("size-9 rounded-xl grid place-items-center bg-gradient-to-br", accentMap[accent])}>
            <Icon className="size-4" />
          </div>
          {typeof delta === "number" && (
            <div className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate font-medium">{label}</div>
        <div className="mt-1 text-xl md:text-2xl font-bold tracking-tight tabular-nums leading-tight">{value}</div>
      </div>
    </div>
  );
};
