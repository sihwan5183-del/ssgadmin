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
    <div className="lg:hidden sticky top-0 z-30 glass-strong border-b border-border/40 pt-[max(0.5rem,env(safe-area-inset-top))]">
    <div className="px-3 py-2 flex items-center gap-2">
      <MobileSidebar />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="size-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow shrink-0">
          <Sparkles className="size-4 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground leading-none">신세계정보통신</div>
          <div className="text-sm font-semibold tracking-tight leading-tight mt-0.5 truncate">영업기획팀</div>
        </div>
      </div>
      <NotificationBell />
    </div>
    <div className="px-3 pb-2">
      <GlobalSearch className="w-full" />
    </div>
    </div>
  );
};
