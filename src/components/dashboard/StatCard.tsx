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
    <div className="group relative glass rounded-2xl p-5 overflow-hidden shadow-card-elevated hover:shadow-elevated transition-all duration-500 hover:-translate-y-0.5">
      <div className={cn("absolute -top-12 -right-12 size-40 rounded-full bg-gradient-to-br blur-2xl opacity-60 group-hover:opacity-100 transition-opacity", accentMap[accent])} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className={cn("size-10 rounded-xl grid place-items-center bg-gradient-to-br", accentMap[accent])}>
            <Icon className="size-5" />
          </div>
          {typeof delta === "number" && (
            <div className={cn(
              "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
              positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
            )}>
              {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {Math.abs(delta).toFixed(1)}%
            </div>
          )}
        </div>
        <div className="mt-5 text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
        {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
};
