import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionBarProps {
  count: number;
  onClear: () => void;
  children: ReactNode;
  label?: string;
  className?: string;
}

/**
 * 선택된 항목이 있을 때만 화면 하단에 떠있는 액션 바.
 * 데스크톱: 가운데 floating pill. 모바일: 풀폭 + safe-area 대응 + 하단 탭바 위에 위치.
 */
export function BulkActionBar({ count, onClear, children, label = "건 선택됨", className }: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "fixed z-50 animate-in slide-in-from-bottom-4 fade-in duration-200",
        // 모바일: 풀폭, MobileNav(약 64px) 위에 위치 + safe-area
        "left-0 right-0 bottom-[calc(64px+env(safe-area-inset-bottom))] px-3",
        // 데스크톱: 가운데 floating
        "lg:left-1/2 lg:right-auto lg:bottom-6 lg:px-0 lg:-translate-x-1/2",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl",
          "bg-card/95 backdrop-blur border border-primary/40",
          "lg:px-4 lg:py-3 lg:gap-3 lg:flex-nowrap",
        )}
      >
        <div className="flex items-center gap-2 pr-2 lg:pr-3 border-r border-border/50">
          <span className="size-9 lg:size-8 rounded-full bg-primary/15 text-primary-glow grid place-items-center text-sm font-bold tabular-nums">
            {count}
          </span>
          <span className="text-xs lg:text-sm text-muted-foreground whitespace-nowrap">{label}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">{children}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 lg:h-8 lg:w-8 ml-auto lg:ml-1 shrink-0"
          onClick={onClear}
          aria-label="선택 해제"
        >
          <X className="size-5 lg:size-4" />
        </Button>
      </div>
    </div>
  );
}
