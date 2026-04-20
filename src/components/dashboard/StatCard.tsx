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
}

const accentMap = {
  primary: "from-primary/30 to-primary-glow/10 text-primary-glow",
  secondary: "from-secondary/30 to-primary/10 text-secondary",
  success: "from-success/30 to-success/5 text-success",
  warning: "from-warning/30 to-warning/5 text-warning",
};

export const StatCard = ({ label, value, delta, icon: Icon, accent = "primary", hint }: StatCardProps) => {
  const positive = (delta ?? 0) >= 0;
  return (
    <div
      className="group relative glass rounded-xl p-3 overflow-hidden shadow-card-elevated hover:shadow-elevated transition-all duration-300 hover:-translate-y-0.5"
      title={hint}
    >
      <div className={cn("absolute -top-10 -right-10 size-32 rounded-full bg-gradient-to-br blur-2xl opacity-60 group-hover:opacity-100 transition-opacity", accentMap[accent])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className={cn("size-8 rounded-lg grid place-items-center bg-gradient-to-br", accentMap[accent])}>
            <Icon className="size-4" />
          </div>
          {typeof delta === "number" && (
            <div className={cn(
              "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {positive ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground truncate">{label}</div>
        <div className="mt-0.5 text-lg md:text-xl font-bold tracking-tight tabular-nums">{value}</div>
      </div>
    </div>
  );
};
