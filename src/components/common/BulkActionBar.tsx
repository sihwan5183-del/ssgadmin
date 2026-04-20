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
 * 자식으로 임의의 버튼들을 받습니다 (예: <Button>일괄 삭제</Button>).
 */
export function BulkActionBar({ count, onClear, children, label = "건 선택됨", className }: BulkActionBarProps) {
  if (count <= 0) return null;
  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl",
        "bg-card/95 backdrop-blur border border-primary/40",
        "animate-in slide-in-from-bottom-4 fade-in duration-200",
        className,
      )}
    >
      <div className="flex items-center gap-2 pr-3 border-r border-border/50">
        <span className="size-8 rounded-full bg-primary/15 text-primary-glow grid place-items-center text-sm font-bold tabular-nums">
          {count}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">{children}</div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 ml-1"
        onClick={onClear}
        aria-label="선택 해제"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
