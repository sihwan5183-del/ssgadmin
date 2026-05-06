import { Sparkles } from "lucide-react";
import { MobileSidebar } from "./MobileSidebar";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";

/**
 * 모바일 전용 상단 바 — 햄버거 + 로고 + 알림.
 * lg 이상에서는 숨김.
 */
export const MobileTopBar = () => {
  return (
    <div className="lg:hidden sticky top-0 z-30 glass-strong border-b border-border/40 pt-[max(0.25rem,env(safe-area-inset-top))]">
      <div className="px-2.5 py-1.5 flex items-center gap-2">
        <MobileSidebar />
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="size-7 rounded-lg bg-gradient-primary grid place-items-center shadow-glow shrink-0">
            <Sparkles className="size-3.5 text-primary-foreground" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[9px] text-muted-foreground leading-none">U+다이렉트</div>
            <div className="text-sm font-semibold tracking-tight truncate">영업기획팀</div>
          </div>
        </div>
        <NotificationBell />
      </div>
      <div className="px-2.5 pb-1.5">
        <GlobalSearch className="w-full" />
      </div>
    </div>
  );
};
