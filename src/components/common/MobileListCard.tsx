import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * 모바일 리스트 카드 — 테이블 행을 카드형으로 자동 전환할 때 사용.
 * 좌측 체크박스(선택적) + 본문 + 하단 액션을 카드에 담는다.
 */
export interface MobileListCardProps {
  selected?: boolean;
  onToggleSelect?: () => void;
  onClick?: () => void;
  title: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  body?: ReactNode;
  right?: ReactNode;
  actions?: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "danger";
}

const toneMap = {
  default: "border-border/40",
  warning: "border-amber-400 bg-amber-50/50",
  danger: "border-destructive/40 bg-destructive/5",
};

export const MobileListCard = ({
  selected,
  onToggleSelect,
  onClick,
  title,
  meta,
  badges,
  body,
  right,
  actions,
  className,
  tone = "default",
}: MobileListCardProps) => {
  return (
    <div
      className={cn(
        "rounded-xl border glass p-3 transition-colors",
        toneMap[tone],
        selected && "ring-2 ring-primary/40 bg-primary/5",
        onClick && "active:scale-[0.99] cursor-pointer",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {onToggleSelect && (
          <div onClick={(e) => e.stopPropagation()} className="pt-0.5">
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect()}
              className="size-5"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold leading-tight truncate">{title}</div>
              {meta && (
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {meta}
                </div>
              )}
            </div>
            {right && <div className="text-right shrink-0">{right}</div>}
          </div>
          {badges && <div className="mt-2 flex flex-wrap gap-1.5">{badges}</div>}
          {body && <div className="mt-2 text-xs text-muted-foreground">{body}</div>}
          {actions && (
            <div onClick={(e) => e.stopPropagation()} className="mt-3 flex items-center gap-2 flex-wrap">
              {actions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
