import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export const Header = ({ title, subtitle }: HeaderProps) => {
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

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="고객명 · 직원 · 모델 검색"
            className="pl-9 h-10 bg-card/60 border-border/60 focus-visible:ring-primary"
          />
        </div>
        <Button variant="ghost" size="icon" className="rounded-full glass">
          <Bell className="size-4" />
        </Button>
        <div className="size-10 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground shadow-glow">
          기획
        </div>
      </div>
    </header>
  );
};
