import { useViewScope } from "@/contexts/ViewScopeContext";
import { Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

export const ScopeToggle = () => {
  const { scope, setScope } = useViewScope();
  const items = [
    { key: "personal" as const, label: "내 실적", icon: User },
    { key: "team" as const, label: "팀 전체", icon: Users },
  ];
  return (
    <div className="flex p-1 rounded-2xl bg-muted/50 border border-border/40">
      {items.map((it) => {
        const Icon = it.icon;
        const active = scope === it.key;
        return (
          <button
            key={it.key}
            onClick={() => setScope(it.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-300 whitespace-nowrap",
              active
                ? "bg-gradient-primary text-primary-foreground shadow-glow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            {it.label}
          </button>
        );
      })}
    </div>
  );
};
